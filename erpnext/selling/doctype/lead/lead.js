// ERPNext - web based ERP (http://erpnext.com)
// Copyright (C) 2012 Web Notes Technologies Pvt Ltd
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Module CRM

$import(SMS Control)

cur_frm.cscript.onload = function(doc, cdt, cdn) {
  if(user =='Guest'){
    hide_field(['status', 'naming_series', 'order_lost_reason', 'customer', 'rating', 'fax', 'website', 'territory', 'TerritoryHelp', 'address_line1', 'address_line2', 'city', 'state', 'country', 'pincode', 'address', 'lead_owner', 'market_segment', 'industry', 'campaign_name', 'interested_in', 'company', 'fiscal_year', 'contact_by', 'contact_date', 'last_contact_date', 'contact_date_ref', 'to_discuss', 'More Info', 'follow_up', 'Communication History', 'cc_to', 'subject', 'message', 'Attachment Html', 'Create New File', 'lead_attachment_detail', 'Send Email', 'Email', 'Create Customer', 'Create Enquiry', 'Next Steps', 'transaction_date', 'type', 'source']);
    doc.source = 'Website';
  }
  if(!doc.status) set_multiple(dt,dn,{status:'Open'});

  if (!doc.date){ 
    doc.date = date.obj_to_str(new Date());
  }
  // set naming series
  if(user=='Guest') doc.naming_series = 'WebLead';
  
  cur_frm.add_fetch('customer', 'customer_name', 'company_name');	
}

cur_frm.cscript.refresh = function(doc, cdt, cdn) {
  // custom buttons
  //---------------
  cur_frm.clear_custom_buttons()
  if(!doc.__islocal && !in_list(['Converted', 'Lead Lost'], doc.status)) {
    cur_frm.add_custom_button('Create Customer', cur_frm.cscript['Create Customer']);
    cur_frm.add_custom_button('Create Enquiry', cur_frm.cscript['Create Enquiry']);
    cur_frm.add_custom_button('Send SMS', cur_frm.cscript['Send SMS']);
  }
}


// Client Side Triggers
// ===========================================================
// ************ Status ******************
cur_frm.cscript.status = function(doc, cdt, cdn){
  cur_frm.cscript.refresh(doc, cdt, cdn);
}

/*
// *********** Country ******************
// This will show states belonging to country
cur_frm.cscript.country = function(doc, cdt, cdn) {
  var mydoc=doc;
  $c('runserverobj', args={'method':'check_state', 'docs':compress_doclist([doc])},
    function(r,rt){
      if(r.message) {
        var doc = locals[mydoc.doctype][mydoc.name];
        doc.state = '';
        get_field(doc.doctype, 'state' , doc.name).options = r.message;
        refresh_field('state');
      }
    }
  );
}
*/

cur_frm.cscript.TerritoryHelp = function(doc,dt,dn){
  var call_back = function(){
    var sb_obj = new SalesBrowser();        
    sb_obj.set_val('Territory');
  }

  loadpage('Sales Browser',call_back);
}

// Create New File
// ===============================================================
cur_frm.cscript['Create New File'] = function(doc){
  new_doc("File");
}

//Trigger in Item Table
//===================================
cur_frm.cscript.item_code=function(doc,cdt,cdn){
  var d = locals[cdt][cdn];
  if (d.item_code) { get_server_fields('get_item_detail',d.item_code,'lead_item_detail',doc,cdt,cdn,1);}
}

// Create New Customer
// ===============================================================
cur_frm.cscript['Create Customer'] = function(){
  var doc = cur_frm.doc;
  $c('runserverobj',args={ 'method':'check_status', 'docs':compress_doclist([doc])},
    function(r,rt){
      if(r.message == 'Converted'){
        msgprint("This lead is already converted to customer");
      }
      else{
        n = createLocal("Customer");
        $c('dt_map', args={
          'docs':compress_doclist([locals["Customer"][n]]),
          'from_doctype':'Lead',
          'to_doctype':'Customer',
          'from_docname':doc.name,
          'from_to_list':"[['Lead', 'Customer']]"
        }, 
        function(r,rt) {
          loaddoc("Customer", n);
        }
        );
      }
    }
  );
}

// send email
// ===============================================================
cur_frm.cscript['Send Email'] = function(doc,cdt,cdn){
  if(doc.__islocal != 1){
    $c_obj(make_doclist(doc.doctype, doc.name),'send_mail','',function(r,rt){});
  }else{
    msgprint("Please save lead first before sending email")
  }
}

// Create New Enquiry
// ===============================================================
cur_frm.cscript['Create Enquiry'] = function(){
  var doc = cur_frm.doc;
  $c('runserverobj',args={ 'method':'check_status', 'docs':compress_doclist([doc])},
    function(r,rt){
      if(r.message == 'Converted'){
        msgprint("This lead is now converted to customer. Please create enquiry on behalf of customer");
      }
      else{
        n = createLocal("Enquiry");
        $c('dt_map', args={
          'docs':compress_doclist([locals["Enquiry"][n]]),
          'from_doctype':'Lead',
          'to_doctype':'Enquiry',
          'from_docname':doc.name,
          'from_to_list':"[['Lead', 'Enquiry']]"
        }
        , function(r,rt) {
            loaddoc("Enquiry", n);
          }
        );
      }
    }
  );
}

//get query select Territory
cur_frm.fields_dict['territory'].get_query = function(doc,cdt,cdn) {
  return 'SELECT `tabTerritory`.`name`,`tabTerritory`.`parent_territory` FROM `tabTerritory` WHERE `tabTerritory`.`is_group` = "No" AND `tabTerritory`.`docstatus`!= 2 AND `tabTerritory`.%(key)s LIKE "%s" ORDER BY  `tabTerritory`.`name` ASC LIMIT 50';
}
