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

erpnext.products = {}

wn.require('erpnext/website/js/product_category.js');

pscript.onload_products = function(wrapper) {
	sys_defaults.default_product_category = JSON.parse(sys_defaults.default_product_category);
	erpnext.products.wrapper = wrapper;	

	// make lists
	erpnext.make_product_categories(wrapper);
	erpnext.products.make_product_list(wrapper);
	
	// button
	$(wrapper).find('.products-search .btn').click(function() {
		wrapper.mainlist.run();
	});
	
	$(wrapper).find('.products-search input').keypress(function(ev) {
		if(ev.which==13) $(wrapper).find('.products-search .btn').click();
	});
}

pscript.onshow_products = function(wrapper) {
	// show default product category
	erpnext.products.set_group();
}

erpnext.products.get_group = function() {
	var route = window.location.hash.split('/');
	if(route.length>1) {
		// from url
		var grp = erpnext.product_item_group[route[1]];
		var label = route[1];
	} else {
		// default
		var grp = sys_defaults.default_product_category.item_group;
		var label = sys_defaults.default_product_category.label;
	}
	erpnext.products.cur_group = grp;
	return {grp:grp, label:label};
}

erpnext.products.make_product_list = function(wrapper) {
	wrapper.mainlist = new wn.widgets.Listing({
		parent: $(wrapper).find('.web-main-section').get(0),
		run_btn: $(wrapper).find('.products-search .btn').get(0),
		hide_refresh: true,
		get_query: function() {
			var srch = $('input[name="products-search"]').val()
			var search_cond = 'and (t1.short_description like "%%(srch)s%"\
				or t1.title like "%%(srch)s%")';
			args = {
				search_cond: srch ? repl(search_cond, {srch:srch}) : '',
				cat: erpnext.products.cur_group
			};
			return repl('select t1.name, t1.title, t1.thumbnail_image, \
				t1.page_name, t1.short_description \
				from tabProduct t1, tabItem t2 \
				where t1.item = t2.name \
				and ifnull(t1.published,0)=1 \
				and t2.item_group="%(cat)s" \
				%(search_cond)s', args)
		},
		render_row: function(parent, data) {
			parent.innerHTML = repl('<div style="float:left; width: 115px;">\
				<img src="files/%(thumbnail_image)s" style="width:100px;"></div>\
				<div style="float:left; width: 400px">\
					<p><b><a href="#!%(page_name)s">%(title)s</a></b></p>\
					<p>%(short_description)s</p></div>\
				<div style="clear: both;"></div><hr />', data);
		}
	});
}

erpnext.products.set_group = function() {
	var cat = erpnext.products.get_group();
	if(!cat.grp) {
		// still nothing
		setTimeout('erpnext.products.set_group()', 1000);
		return;		
	}
	// get erpnext.products.default_category
	var wrapper = erpnext.products.wrapper;
	
	$(wrapper).find('h1').html(cat.label);
	wrapper.mainlist.run();
}
