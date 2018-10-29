'''Fetches reports from the Alma Analytics API.'''

import logging
import requests
import configparser as cp
from logging import FileHandler
from lxml import etree
import sys
import pandas as pd

# Change the default delimiter -- formula columns in Analytics may have the equals sign in the name
config = cp.ConfigParser(delimiters=('|'))
# This setting preserves case in the key names
config.optionxform = lambda option: option
config.read('alma_analytics.ini')
column_map = dict(config['COLUMN_MAP'].items())

# Set up logging to use a file on disk
analytics_log = logging.getLogger('analytics')
analytics_log.setLevel(logging.INFO)
file_handler = FileHandler(config['LOCAL_FILES']['analytics_log'])
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
analytics_log.addHandler(file_handler)

headers= {'Authorization': 'apikey {}'.format(config['API_KEYS']['analytics'])}
params = {'limit': '1000'}


def parse_result(data):
	'''Helper method: parses XML from the Alma Analytics API.'''

	# Hack for handling the default namespace
	# https://developers.exlibrisgroup.com/forum/posts/list/478.page
	cleaned_text = data.replace('xmlns="urn:schemas-microsoft-com:xml-analysis:rowset"', '')
	# Need to encode the result first and set up the parser, otherwise lxml throws an error
	xml = cleaned_text.encode('utf-8')
	parser = etree.XMLParser(ns_clean=True, recover=True, encoding='utf-8')
	root = etree.fromstring(xml, parser=parser)
	return root

def xml_to_table(root, columns=None):
	''' Converts an XML report from Alma Analytics into list of dictionaries'''
	# If we are paging results, only need to get the columns the first time
	if not columns:
		# Register the namespace map, omitting the empty namespace
		nsmap = {n[0]: n[1] for n in root.xpath('//namespace::*') if n[0]}
		# Get the column headings, which are not elsewhere present in the doc
		columns = dict(zip(root.xpath('.//xsd:element/@name', namespaces=nsmap),  
				root.xpath('.//@saw-sql:columnHeading', namespaces=nsmap)))
	# Build a list of dicts to convert to a dataframe
	# Using this structure so that we can handle missing child nodes in a given row -- pandas will insert NaN values
	records = []
	# Iterate over the rows in the report
	for node in root.xpath('.//Row'):
		# All the children should be cell values with tags like Column0, Column1, etc.
		children = node.xpath('*')
		# Each row is a dictionary mapping its column name to its value
		row = {columns[c.tag]: c.text for c in children}
		records.append(row)
	return records, columns

def page_results(root, report, columns, path): 
	# Token provided only in the first page of results
	token = root.find('.//ResumptionToken')
	if token is not None:
		token = token.text
		is_finished = root.xpath('//IsFinished')[0].text
		# Repeat until the "IsFinished flag is set to true
		while is_finished == 'false':
			# after the first query, if there is a resumption token, use that instead of the path
			r = requests.get(path + "?token={}".format(token),
					params=params,
					headers=headers)
			if r.status_code != 200:
				raise AssertionError('Request failed')
			root = parse_result(r.text)
			# Pass in the column dict from the first page of results
			next_page, columns = xml_to_table(root, columns)
			# Concat with the previous table
			report = pd.concat([report, pd.DataFrame.from_records(next_page)])
			is_finished = root.xpath('//IsFinished')[0].text
	return report

def do_request(path_key):
	'''Queries the Alma Analytics API for the specified report, and returns it as a pandas DataFrame'''
	analytics_path = config['PATHS']['base_url'] + config['PATHS']['analytics_path'] 
	# Don't pass the path as a parameter, or else requests will encode it in a way that OBIEE doesn't like
	# Get the report from Alma Analytics 
	r = requests.get(analytics_path + '?path={}'.format(config['PATHS'][path_key]),
		params=params, 
		headers=headers)
	try:
		if r.status_code != 200:
			raise AssertionError('Request failed')
		# Parse the XML as a table
		root = parse_result(r.text)
		report, columns = xml_to_table(root)
		report = pd.DataFrame.from_records(report)	
		report = page_results(root, report, columns, analytics_path)
	except Exception as e:
		analytics_log.error('{}: {}'.format(e.args, r.text))
		return None
	# Drop the extra column returned by the Analytics API
	report = report.drop('0', axis=1)
	# Changing the columns per the INI file
	# First need to strip out leading and trailing white space, which may be added to some formula columns
	report.columns = [c.strip() for c in report.columns]
	if set(report.columns) == set(column_map.keys()):
		return report.rename(columns=column_map)
	else:
		# If columns not defined in .INI, just convert to lowercase and add underscores 
		report.columns = ['_'.join(c.lower().split()) for c in report.columns]
		return report

if __name__ == '__main__':
	if sys.argv[1]:
		try:
			do_request(sys.argv[1]).to_csv('{}.csv'.format(sys.argv[1]), index=False)
		except Exception as e:
			analytics_log.error('{}'.format(e.args))
	else:
		print("When running from the command line, please pass an Alma Analytics report path name (as defined in the alma_analytics.ini file) as an argument to this script.")