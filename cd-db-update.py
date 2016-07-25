
#!/home/dsmith/voyager/VGR/bin/python


# Script to fetch data from Voyager/Oracle and populate a postgres backend ###
# Uses cx_Oracle module (requires Oracle InstantClient on Windows)

import cx_Oracle
import logging
import pandas as pd
from pandas import DataFrame
import sqlalchemy
import os
from datetime import datetime

# set up logging for db calls
logging.basicConfig()
engine = sqlalchemy.create_engine(('postgresql://colldev:GWL1br@r13s@localhost:5432/colldev_db'))
db_logger = logging.getLogger('sqlalchemy.engine')
db_logger.setLevel(logging.INFO)
handler = logging.FileHandler('dashboard_' + datetime.today().strftime('%d-%m-%Y') +'.log')
db_logger.addHandler(handler)

# We do this to make sure that the Oracle client is using the right encoding
os.environ["NLS_LANG"] = "AMERICAN_AMERICA.AL32UTF8"

# our login info for the Voyager database
dsn = cx_Oracle.makedsn('oracle.wrlc.org', '1521', 'VGER')
connection = cx_Oracle.connect('dbread', 'libs8db', dsn)

# helper function for parsing results from the SQL cursor object
def get_data(cursor):
    header = [c[0] for c in cursor.description]
    data = []
    for row in cursor:
        data.append(dict(zip(header, row)))
    return data

queries = {}

# We use pandas for ease and speed of concatenating and cleaning up the results
# This allows us to post-process data efficiently, instead of having to write overly complex and sluggish SQL queries

#Query to fetch the allocated-level funds, for tracking both the net allocation (CURRENT_ALLOCATION) 
# plus existing commitments (PO's that haven't been invoiced)
# Using the FUNDLEDGER_VW.FISCAL_PERIOD_START on all these queries to select the relevant ledgers
# The aggregate functions are used here because occasionally the same allocation fund name will appear under multiple summary funds on the same ledger, with different amounts associated with each

queries['ledgers'] = '''
select  
    sum(current_allocation) as current_allocation,
    fund_name,
    fiscal_period_name,
    ledger_name, 
    sum(commit_pending) as commit_pending,
    sum(commitments) as commitments,
    sum(expend_pending) as expend_pending,
    sum(expenditures) as expenditures
from fundledger_vw flvw
where
    (flvw.fiscal_period_name like 'GW%') 
        and (flvw.fund_category = 'Allocated') 
        and (flvw.fiscal_period_start >= to_date('07-01-2015', 'mm-dd-YYYY'))
group by
    fund_name, fiscal_period_name, ledger_name
'''

#Invoices query, using the invoice_line_item tables to link purchase order, invoice, line item, and fund
#This query works to retrieve inv_line_item_funds AND line_item_copy_status without duplication of records. 
#IMPORTANT: Link to INVOICE_LINE_ITEM_FUNDS on BOTH inv_line_item_id AND copy_id (if including line_item_copy_status).
#LINE_ITEM_COPY_STATUS includes detailed status information about the line item


queries['invoices'] = '''
select 
    invlifunds.amount / 100 as amount,
    litem.bib_id,
    bib_text.title,
    location.location_code,
    po.po_number,
    vendor.vendor_code,
    vendor.vendor_name,
    flvw.fund_name,
    flvw.parent_fund,
    flvw.ledger_name,
    flvw.fund_category,
    flvw.fiscal_period_name,
    invoice.invoice_number,
    invoice.invoice_date,
    invstat.invoice_status_desc as invoice_status,
    invoice.invoice_status_date,
    invoice.invoice_update_date,
    invistats.line_item_status_desc as invoice_item_status,
    listats.line_item_status_desc as line_item_status
from
    line_item litem
inner join
    purchase_order po
on
    litem.po_id = po.po_id
inner join
    vendor
on
    po.vendor_id = vendor.vendor_id
inner join
    bib_text
on
    bib_text.bib_id = litem.bib_id
inner join
    bib_master
on
    bib_text.bib_id = bib_master.bib_id
inner join
    invoice_line_item invlitem
on 
    litem.line_item_id = invlitem.line_item_id
inner join
    line_item_copy_status licstatus
on
    litem.line_item_id = licstatus.line_item_id
left join
    mfhd_master
on 
    licstatus.mfhd_id = mfhd_master.mfhd_id
left join
    location
on
    mfhd_master.location_id = location.location_id
inner join
    line_item_status invistats
on
    licstatus.invoice_item_status = invistats.line_item_status
inner join
    line_item_status listats
on
    licstatus.line_item_status = listats.line_item_status 
inner join
    invoice
on
    invlitem.invoice_id = invoice.invoice_id
inner join
    invoice_status invstat
on
    invoice.invoice_status = invstat.invoice_status
inner join
    invoice_line_item_funds invlifunds
on
    invlifunds.inv_line_item_id = invlitem.inv_line_item_id and invlifunds.copy_id = licstatus.copy_id
inner join
    fundledger_vw flvw
on 
    invlifunds.ledger_id = flvw.ledger_id and invlifunds.fund_id = flvw.fund_id
where
    bib_master.library_id = 7 
    and flvw.fiscal_period_start >= to_date('07-01-2015', 'mm-dd-YYYY')
'''

#Query to retrieve "adjustments," which are added to the invoice record, reflecting charges like postage and processing, but 
#which do not correspond to separate line items
queries['adj'] = '''
select 
    invoice.invoice_number,
    invoice.invoice_date,
    invoice.invoice_status_date,
    invoice.invoice_update_date,
    invstat.invoice_status_desc as invoice_status,
    vendor.vendor_code,
    vendor.vendor_name,
    flvw.fund_name,
    flvw.fund_category,
    flvw.ledger_name,
    flvw.parent_fund,
    flvw.fiscal_period_name,
    fpay.amount / 100 as amount,
    adjr.reason_text
from 
    invoice 
inner join 
    price_adjustment padj
on  
    invoice.invoice_id = padj.object_id
inner join
    invoice_status invstat
on
    invoice.invoice_status = invstat.invoice_status
inner join
    fund_payment fpay
on
    padj.payment_id = fpay.payment_id
inner join
    fundledger_vw flvw
on
    fpay.fund_id = flvw.fund_id and fpay.ledger_id = flvw.ledger_id
inner join
    adjust_reason adjr
on
    padj.reason_id = adjr.reason_id
inner join
    vendor
on
    invoice.vendor_id = vendor.vendor_id
where flvw.fiscal_period_start >= to_date('07-01-2015', 'mm-dd-YYYY') 
        and padj.object_type = 'C'
        and flvw.fiscal_period_name like 'GW%'
'''


class Dashboard:

    def __init__(self):
        self.cursor = connection.cursor()

    def query_Oracle(self):
        #Execute the queries on Oracle, store the results for further cleanup

        try:
            self.ledgers = DataFrame.from_records(get_data(self.cursor.execute(queries['ledgers'])))
            self.invoices = DataFrame.from_records(get_data(self.cursor.execute(queries['invoices'])))
            self.adjustments = DataFrame.from_records(get_data(self.cursor.execute(queries['adj'])))
        except Exception as e:
            db_logger.error('ORACLE error', exc_info=True)
            raise e

        # Add the adjustments to the table of line_items
        self.adjustments.rename(columns={'REASON_TEXT': 'TITLE'}, inplace=True)
        self.invoices = pd.concat([self.invoices, self.adjustments], axis=0, ignore_index=True)

        #Some line items are charged to Allocated funds, not Reporting funds. 
        #But in the app, the user selects an Allocated fund, which is mapped to the "Parent Fund" column in the data.
        #So copy over those fund names where the fund category is "Allocated" to the parent fund column
        self.invoices.loc[self.invoices.FUND_CATEGORY == 'Allocated', 'PARENT_FUND'] = self.invoices.loc[self.invoices.FUND_CATEGORY == 'Allocated', 'FUND_NAME']

        #Don't need this column anymore
        self.invoices.drop('FUND_CATEGORY', axis=1, inplace=True)

        connection.close()

        return self

    def load_postgres(self):
        #postgres columns are lower case / Oracle returns all upper case
        self.invoices.columns = map(str.lower, self.invoices.columns)
        self.ledgers.columns = map(str.lower, self.ledgers.columns)

        #pandas takes care of generating the queries for us!
        self.invoices.to_sql('invoices', engine, if_exists='replace', index=False)
        self.ledgers.to_sql('ledgers', engine, if_exists='replace', index=False)

if __name__ == '__main__':
    db = Dashboard()
    db.query_Oracle().load_postgres()