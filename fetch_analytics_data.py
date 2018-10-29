from alma_analytics_api import do_request 

for report in ['sum_fund_item_level', 'fiscal_periods', 'sum_fund_allocation']:
	do_request(report).to_csv('./public/data/{}.csv'.format(report), index=False)