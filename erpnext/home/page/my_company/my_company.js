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

pscript['onload_My Company'] = function() {
	var wrapper = wn.pages['My Company'];
	
	// body
	wrapper.className = 'layout_wrapper';
	wrapper.head = new PageHeader(wrapper, 'People');
	wrapper.body = $a(wrapper, 'div', '', {marginRight:'11px', marginTop:'11px'});
	
	wrapper.message = $a(wrapper.body, 'div');
	wrapper.tab = make_table(wrapper.body, 1, 2, '100%', ['25%','75%']);
	
	$y(wrapper.tab, {tableLayout:'fixed'})
	
	pscript.myc_make_toolbar(wrapper);
	pscript.myc_make_list(wrapper);
	
	if(pscript.is_erpnext_saas) {
		pscript.myc_show_erpnext_message();
	}
}

pscript.myc_make_toolbar = function(wrapper) {
	if(has_common(user_roles, ['System Manager', 'Administrator'])) {
		wrapper.head.add_button('Add User', pscript.myc_add_user)	
	}
}

//
// Only for erpnext product - show max users allowed
//
pscript.myc_show_erpnext_message = function() {
	var callback = function(r, rt) {
		if(r.exc) {msgprint(r.exc); return;}
		$a(wrapper.message, 'div', 'help_box', '', 'You have ' + r.message.enabled 
		+ ' users enabled out of ' + r.message.max_user 
		+ '. Go to <a href="javascript:pscript.go_to_account_settings()">Account Settings</a> to increase the number of users');
	}
	$c_page('home', 'my_company', 'get_max_users', '', callback)
}

//
// Add user dialog and server call
//
pscript.myc_add_user = function() {
	var fields = [{
			fieldtype: 'Data',
			fieldname: 'user',
			reqd: 1,
			label: 'Email Id of the user to add'
		},
		{
			fieldtype: 'Data',
			fieldname: 'first_name',
			reqd: 1,
			label: 'First Name'
		},
		{
			fieldtype: 'Data',
			fieldname: 'last_name',
			label: 'Last Name'
		},
		{
			fieldtype: 'Data',
			fieldname: 'password',
			reqd: 1,
			label: 'Password'
		},
		{
			fieldtype: 'Button',
			label: 'Add',
			fieldname: 'add'
		}];

	fields.push();

	var d = new wn.widgets.Dialog({
		title: 'Add User',
		width: 400,
		fields: fields
	});
	d.make();
	d.fields_dict.add.input.onclick = function() {
		v = d.get_values();
		if(v) {
			d.fields_dict.add.input.set_working();
			$c_page('home', 'my_company', 'add_user', v, function(r,rt) {
				if(r.exc) { msgprint(r.exc); return; }
				else {
					d.hide();
					pscript.myc_refresh();
				}
			})
		}
	}
	d.show();
}

pscript.myc_refresh = function() {
	wn.pages['My Company'].member_list.lst.run();	
}

pscript.myc_make_list= function(wrapper) {
	wrapper.member_list = new MemberList(wrapper)
}

pscript.get_fullname=function(uid) {
	if(uid=='Administrator') return uid;
	return wn.pages['My Company'].member_list.member_items[uid].fullname;		
}



//=============================================

MemberList = function(parent) {
	var me = this;
	this.profiles = {};
	this.member_items = {};
	this.role_objects = {};
	this.cur_profile = null;
	
	this.list_wrapper = $a($td(parent.tab,0,0), 'div', '', {marginLeft:'11px'});
	var cell = $td(parent.tab,0,1);
	$y(cell, { border: '1px solid #aaa' });
	cell.className = 'layout_wrapper';
	this.profile_wrapper = $a(cell, 'div');
	
	this.no_user_selected = $a(this.profile_wrapper, 'div', 'help_box', null, 'Please select a user to view profile');
	
	this.make_search();
	if(pscript.online_users) {
		this.make_list();		
	} else {
		$c_page('home', 'event_updates', 'get_online_users', '', function(r,rt) {
			pscript.online_users = r.message;
			me.make_list();
		})
	}
}

// ----------------------

MemberList.prototype.make_search = function() {
	var me = this;
	this.search_area = $a(this.list_wrapper, 'div', '', {textAlign:'center', padding:'8px'});
	this.search_inp = $a(this.search_area, 'input', '', {fontSize:'14px', width:'80%'});
	this.search_inp.set_empty = function() {
		this.value = 'Search'; $fg(this,'#888');
	}
	this.search_inp.onfocus = function() {
		$fg(this,'#000');
		if(this.value=='Search')this.value = '';
	}
	this.search_inp.onchange = function() {
		if(!this.value) this.set_empty();
	}
	this.search_inp.set_empty();
}

// ----------------------

MemberList.prototype.make_list = function() {
	var me = this;
	this.lst_area = $a(this.list_wrapper, 'div');

	this.lst = new wn.widgets.Listing({
		parent: this.lst_area,
		as_dict: 1,
		get_query: function() {
			var c1 = '';
			if(me.search_inp.value && me.search_inp.value != 'Search') {
				var c1 = repl(' AND (first_name LIKE "%(txt)s" OR last_name LIKE "%(txt)s" OR name LIKE "%(txt)s")', {txt:'%' + me.search_inp.value + '%'});
			}

			return repl("SELECT name, \
				ifnull(concat_ws(' ', first_name, last_name),'') as full_name, \
				gender, file_list, enabled \
				FROM tabProfile \
				WHERE docstatus != 2 \
				AND name not in ('Guest','Administrator') %(cond)s \
				ORDER BY name asc",{cond:c1});			
		},
		render_row: function(parent, data) {
			me.member_items[data.name] = new MemberItem(parent, data, me);			
		}
	});	
	this.lst.run();
}


/*
Create / show profile
*/
MemberList.prototype.show_profile = function(uid, member_item) {
	$dh(this.no_user_selected);

	// if not exists, create
	if(!this.profiles[uid]) {
		if(!member_item) member_item = this.member_items[uid];
		this.profiles[uid] = new MemberProfile(this.profile_wrapper, uid, member_item);		
	}

	// hide current
	if(this.cur_profile)
		this.cur_profile.hide();
	
	// show this
	this.profiles[uid].show();
	this.cur_profile = this.profiles[uid];
}


// Member Item
// List item of all profiles
// on the left hand sidebar of the page

MemberItem = function(parent, det, mlist) {
	var me = this;
	this.det = det;
	this.wrapper = $a(parent, 'div');
	this.enabled = det.enabled;
	
	this.tab = make_table(this.wrapper, 1,2,'100%', ['20%', '70%'], {padding:'4px', overflow:'hidden'});
	$y(this.tab, {tableLayout:'fixed', borderCollapse:'collapse'})
	
	this.is_online = function() {
		for(var i=0;i<pscript.online_users.length;i++) {
			if(det.name==pscript.online_users[i][0]) return true;
		}
	}
	
	this.refresh_name_link = function() {
		// online / offline
		$fg(this.name_link,'#00B'); 
		if(!this.is_online())
			$fg(this.name_link,'#444');
		if(!this.enabled)
			$fg(this.name_link,'#777'); 

	}
	
	this.set_image = function() {
		// image
		this.img = $a($td(this.tab,0,0),'img','',{width:'41px'});
		set_user_img(this.img, det.name, null, 
			(det.file_list ? det.file_list.split(NEWLINE)[0].split(',')[1] : 
				('no_img_' + (det.gender=='Female' ? 'f' : 'm'))));
	}
	
	// set other details like email id, name etc
	this.set_details = function() {
		// name
		this.fullname = det.full_name || det.name;
		var div = $a($td(this.tab, 0, 1), 'div', '', {fontWeight: 'bold',padding:'2px 0px'});
		this.name_link = $a(div,'span','link_type');
		this.name_link.innerHTML = crop(this.fullname, 15);
		this.name_link.onclick = function() {
			mlist.show_profile(me.det.name, me);
		}

		// "you" tag
		if(user==det.name) {
			var span = $a(div,'span','',{padding:'2px' ,marginLeft:'3px'});
			span.innerHTML = '(You)'
		}

		// email id
		var div = $a($td(this.tab, 0, 1), 'div', '', {color: '#777', fontSize:'11px'});
		div.innerHTML = det.name;

		// working img
		var div = $a($td(this.tab, 0, 1), 'div');
		this.working_img = $a(div,'img','',{display:'none'}); 
		this.working_img.src = 'lib/images/ui/button-load.gif';
		
		this.refresh_name_link();
		
	}
	
	this.select = function() {
		$(this.wrapper).addClass('my-company-member-item-selected');
	}

	this.deselect = function() {
		$(this.wrapper).removeClass('my-company-member-item-selected');		
	}
	
	this.set_image();
	this.set_details();
	
	// show initial
	if(user==det.name) me.name_link.onclick();
}


//
// Member Profile
// shows profile with Photo and conversation
//
MemberProfile = function(parent, uid, member_item) {
	this.parent = parent;
	this.uid = uid;
	this.member_item = member_item;
	var me = this;

	// make the UI 
	this.make = function() {
		this.wrapper = $a(this.parent, 'div', '', {display:'none'});
		this.tab = make_table(this.wrapper, 3, 2,'100%',['120px',null],{padding:'3px'});
		$y(this.tab, {tableLayout: 'fixed'});
		
		this.make_image_and_bio();
		this.make_toolbar();
		this.make_message_list();
	}
	
	// create elements
	this.make_image_and_bio = function() {
		var rh = $td(this.tab, 0, 1);
		
		// image
		this.img = $a($td(this.tab, 0, 0), 'img','',{width:'80px', marginLeft:'10px'});
		set_user_img(this.img, this.uid);

		// details
		this.name_area = $a(rh, 'div' , 'my-company-name-head');
		var div = $a(rh, 'div', 'my-company-email');
		this.email_area = $a(div, 'span');
		this.online_status_area = $a(div, 'span', 'my-company-online-status');
		this.bio_area = $a(rh, 'div', 'my-company-bio');	
		this.toolbar_area = $a(rh, 'div', 'my-company-toolbar');	
		this.status_span = $a(this.toolbar_area, 'span', '', {marginRight:'7px'});
		
	}
	
	// the toolbar
	this.make_toolbar = function() {
		if(has_common(['Administrator','System Manager'],user_roles)) {
			var roles_btn = $btn(this.toolbar_area, 'Set Roles', function() { me.show_roles() },{marginRight:'3px'});
			var delete_btn = $btn(this.toolbar_area, 'Delete User', function() { me.delete_user(); },{marginRight:'3px'});
			var ip_btn = $btn(this.toolbar_area, 'Securty Settings', function() { me.set_security(); },{marginRight:'3px'});
		}
	}
	
	// create the role object
	this.show_roles = function() {
		if(!this.role_object)
			this.role_object = new RoleObj(this.uid);
		this.role_object.dialog.show();
	}
	
	// show securty settings
	this.set_security = function() {
		var sd = new wn.widgets.Dialog({
			title: 'Set User Security',
			width: 500,
			fields: [
				{
					label:'IP Address', 
					description: 'Restrict user login by IP address, partial ips (111.111.111), \
					multiple addresses (separated by commas) allowed', 
					fieldname:'restrict_ip', 
					fieldtype:'Data'
				},
				
				{
					label:'Login After',
					description: 'User can only login after this hour (0-24)',
					fieldtype: 'Int',
					fieldname: 'login_after'
				},

				{
					label:'Login Before',
					description: 'User can only login before this hour (0-24)',
					fieldtype: 'Int',
					fieldname: 'login_before'
				},
				
				{
					label:'New Password',
					description: 'Update the current user password',
					fieldtype: 'Data',
					fieldname: 'new_password'
				},

				{
					label:'Update',
					fieldtype:'Button',
					fieldname:'update'
				}
			]
		});

		me.sec_dialog = sd

		sd.onshow = function() {
			me.sec_dialog.set_values({
				restrict_ip: me.profile.restrict_ip || '',
				login_before: me.profile.login_before || '',
				login_after: me.profile.login_after || '',
				new_password: ''
			});
		};
		sd.fields_dict.update.input.onclick = function() {
			var btn = this;
			this.set_working();
			var args = me.sec_dialog.get_values();
			args.user = me.profile.name;

			if (args.new_password) {
				var pass_d = new wn.widgets.Dialog({
					title: 'Your Password',
					width: 300,
					fields: [
						{
							label: 'Please Enter <b style="color: black">Your Password</b>',
							description: "Your password is required to update the concerned user's password",
							fieldtype: 'Password',
							fieldname: 'sys_admin_pwd',
							reqd: 1		
						},

						{
							label: 'Continue',
							fieldtype: 'Button',
							fieldname: 'continue'
						}
					]
				});

				pass_d.fields_dict.continue.input.onclick = function() {
					btn.pwd_dialog.hide();					
					args.sys_admin_pwd = btn.pwd_dialog.get_values().sys_admin_pwd;					
					btn.set_working();					
					me.update_security(args);
					btn.done_working();
				}

				pass_d.show();
				btn.pwd_dialog = pass_d;
				btn.done_working();
			} else {
				btn.done_working();
				me.update_security(args);
			}			
		};
		sd.show();		
	}

	this.update_security = function(args) {
		$c_page('home', 'my_company', 'update_security', JSON.stringify(args), function(r,rt) {
			if(r.exc) {
				msgprint(r.exc);				
				return;
			}
			me.sec_dialog.hide();
			$.extend(me.profile, me.sec_dialog.get_values());
		});
	}
	
	// delete user
	// create a confirm dialog and call server method
	this.delete_user = function() {
		var cp = wn.control_panel;

		var d = new Dialog(400,200,'Delete User');
		d.make_body([
			['HTML','','Do you really want to remove '+this.uid+' from system?'],['Button','Delete']
		]);
		d.onshow = function() {
			this.clear_inputs();
		}

		d.widgets['Delete'].onclick = function() {
			this.set_working();

			var callback = function(r,rt) {
				d.hide();
				if(r.exc) {
					msgprint(r.exc);
					return;
				}
				pscript.myc_refresh()
				msgprint("User Deleted Successfully");
			}
			$c_page('home', 'my_company', 'delete_user', {'user': me.uid}, callback);
		}
		d.show();
	}

	// set enabled
	this.set_enable_button = function() {
		var me = this;
		var act = this.profile.enabled ? 'Disable' : 'Enable';

		if(this.status_button) {
			this.status_button.innerHTML = act;	
		} else {	
			// make the button
			this.status_button = $btn(this.toolbar_area, act, function() {
				var callback = function(r,rt) {
					locals['Profile'][me.profile.name].enabled = cint(r.message);
					me.status_button.done_working();
					me.refresh_enable_disable();
				}
				this.set_working();
				$c_page('home','my_company', this.innerHTML.toLowerCase()+'_profile',me.profile.name, callback);
			}, null, null, 1);
		}
		if(this.uid==user) $dh(this.status_button); else $di(this.status_button);
	}
	
	// render the details of the user from Profile
	this.render = function() {
		this.profile = locals['Profile'][uid];
		scroll(0, 0);

		// name
		if(cstr(this.profile.first_name) || cstr(this.profile.last_name)) {
			this.fullname = cstr(this.profile.first_name) + ' ' + cstr(this.profile.last_name);
		} else {
			this.fullname = this.profile.name;
		}
		this.name_area.innerHTML = this.fullname;
		
		// email
		this.email_area.innerHTML = this.profile.name;

		// online / offline
		this.online_status_area.innerHTML = (this.member_item.is_online() ? '(Online)' : '(Offline)')
		if(this.member_item.is_online()) {
			$y(this.online_status_area, {color:'green'});
		}

		// refresh enable / disabled
		this.refresh_enable_disable();

		// designation
		this.bio_area.innerHTML = this.profile.designation ? ('Designation: ' + cstr(this.profile.designation) + '<br>') : '';
		this.bio_area.innerHTML += this.profile.bio ? this.profile.bio : 'No bio';
		
		new MemberConversation(this.wrapper, this.profile.name, this.fullname);
	}
	
	// refresh enable / disable
	this.refresh_enable_disable = function() {
		this.profile = locals['Profile'][this.uid]

		if(!this.profile.enabled) {
			$fg(this.name_area,'#999');
		} else {
			$fg(this.name_area,'#000');
		}

		this.member_item.enabled = this.profile.enabled;
		this.member_item.refresh_name_link();
		
		this.status_span.innerHTML = this.profile.enabled ? 'Enabled' : 'Disabled';

		// set styles and buttons
		if(has_common(['Administrator','System Manager'],user_roles)) {
			this.set_enable_button();
		}		
	}
	
	// Load user profile (if not loaded)
	this.load = function() {
		if(locals['Profile'] && locals['Profile'][uid]) {
			this.render();
			return;
		}
		var callback = function(r,rt) {
			$dh(me.member_item.working_img);
			$ds(me.wrapper);
			me.loading = 0;
			me.render();
		}
		$ds(this.member_item.working_img);
		$dh(this.wrapper);
		this.loading = 1;
		$c('webnotes.widgets.form.load.getdoc', {'name':this.uid, 'doctype':'Profile', 'user':user}, callback);	// onload		
	}
	
	// show / hide
	this.show = function() {
		if(!this.loading)$ds(this.wrapper);

		// select profile
		this.member_item.select();
	}
	this.hide = function() {
		$dh(this.wrapper);

		// select profile
		this.member_item.deselect();
	}
	
	this.make_message_list = function() {
		
	}
	
	this.make();
	this.load();
}




// Member conversation
// Between the current user and the displayed profile
// or if same, then the conversation with all other
// profiles
MemberConversation = function(parent, uid, fullname) {
	var me = this;
	this.wrapper = $a(parent, 'div', 'my-company-conversation');
	this.fullname = fullname;
	this.make = function() {
		if(user!=uid) {
			this.make_input();			
		}
		this.make_list();
		
		// set all messages
		// as "read" (docstatus = 0)
		if(user==uid) {
			$c_page('home', 'my_company', 'set_read_all_messages', '', function(r,rt) { });	
		}
	}
	
	this.make_input = function() {
		this.input_wrapper = $a(this.wrapper, 'div', 'my-company-input-wrapper');
		var tab = make_table(this.input_wrapper, 1, 2, '100%', ['64%','36%'], {padding: '3px'})
		this.input = $a($td(tab,0,0), 'textarea');

		// button
		var div = $a(this.input_wrapper, 'div');
		this.post = $btn(div, 'Post'.bold(), function() { me.post_message(); }, {margin:'0px 13px 0px 3px'})
		this.post.disabled = true;
		
		this.input.onkeyup = this.input.onchange = function() {
			if(this.value) {
				me.post.disabled = false;
			} else {
				me.post.disabled = true;
			}
		}

		// notification check
		this.notify_check = $a_input(div, 'checkbox', null);
		$a(div, 'span', '', {marginLeft:'3px'}, 'Notify ' + fullname + ' by email')
	}
	
	this.post_message = function() {
		if(me.input.value==$(me.input).attr('default_text')) {
			msgprint('Please write a message first!'); return;
		}
		this.post.set_working();
		$c_page('home', 'my_company', 'post_comment', {
			uid: uid,
			comment: $(me.input).val(),
			notify: me.notify_check.checked ? 1 : 0
		}, function(r,rt) {
			$(me.input).val("").blur();
			me.post.done_working();
			if(r.exc) { msgprint(r.exc); return; }
			me.notify_check.checked = false;
			me.refresh();
		})
	}
	
	this.make_list = function() {
		this.lst_area = $a(this.wrapper, 'div', 'my-company-conversation', {padding:'7px 13px'});

		if(user==uid) {
			this.my_messages_box = $a(this.lst_area, 'div', 'my-company-conversation-head', {marginBottom:'7px'}, 'Messages by everyone to me<br>To send a message, click on the user on the left')
		}
		
		this.lst = new wn.widgets.Listing({
			parent: this.lst_area,
			as_dict: 1,
			no_result_message: (user==uid 
				? 'No messages by anyone yet' 
				: 'No messages yet. To start a conversation post a new message'),

			get_query: function() {
				if(uid==user) {
					return repl("SELECT comment, owner, comment_docname, creation, docstatus " +
					"FROM `tabComment Widget Record` "+
					"WHERE comment_doctype='My Company' " +
					"AND comment_docname='%(user)s' " +
					"ORDER BY creation DESC ", {user:user});

				} else {
					return repl("SELECT comment, owner, comment_docname, creation, docstatus " +
					"FROM `tabComment Widget Record` "+
					"WHERE comment_doctype='My Company' " +
					"AND ((owner='%(user)s' AND comment_docname='%(uid)s') " +
					"OR (owner='%(uid)s' AND comment_docname='%(user)s')) " +
					"ORDER BY creation DESC ", {uid:uid, user:user});

				}
			},
			render_row: function(parent, data) {
				new MemberCoversationComment(parent, data, me);
			},
			
		})
		this.refresh();
	}
	
	this.refresh = function() {
		me.lst.run()
	}
	
	this.make();
}

MemberCoversationComment = function(cell, det, conv) {
	var me = this;
	this.det = det;
	this.wrapper = $a(cell, 'div', 'my-company-comment-wrapper');
	this.comment = $a(this.wrapper, 'div', 'my-company-comment');

	this.user = $a(this.comment, 'span', 'link_type', {fontWeight:'bold'}, pscript.get_fullname(det.owner));
	this.user.onclick = function() {
		wn.pages['My Company'].member_list.show_profile(me.det.owner);
	}

	var st = (!det.docstatus ? {fontWeight: 'bold'} : null);
	this.msg = $a(this.comment, 'span', 'social', st, ': ' + det.comment);

	if(det.full_name==user) {
		$y(this.wrapper, {backgroundColor: '#D9D9F3'});
	}
	this.timestamp = $a(this.wrapper, 'div', 'my-company-timestamp', '', comment_when(det.creation));
}







