# ERPNext - web based ERP (http://erpnext.com)
# Copyright (C) 2012 Web Notes Technologies Pvt Ltd
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import webnotes
import json

from webnotes.model.doc import Document
from webnotes.utils import cint

@webnotes.whitelist()
def get(arg=None):
	"""return all users"""
	return webnotes.conn.sql("""select name, file_list, enabled, gender,
	 	restrict_ip, login_before, login_after from tabProfile
		where docstatus<2 and name not in ('Administrator', 'Guest') order by
		ifnull(enabled,0) desc, name""", as_dict=1)

@webnotes.whitelist()
def get_roles(arg=None):
	"""return all roles"""
	return [r[0] for r in webnotes.conn.sql("""select name from tabRole
		where name not in ('Administrator', 'Guest', 'All') order by name""")]

@webnotes.whitelist()
def get_user_roles(arg=None):
	"""get roles for a user"""
	return [r[0] for r in webnotes.conn.sql("""select role from tabUserRole
		where parent=%s""", webnotes.form_dict['uid'])]

@webnotes.whitelist()
def get_perm_info(arg=None):
	"""get permission info"""
	return webnotes.conn.sql("""select parent, permlevel, `read`, `write`, submit,
		cancel, amend from tabDocPerm where role=%s 
		and docstatus<2 order by parent, permlevel""", 
			webnotes.form_dict['role'], as_dict=1)

@webnotes.whitelist()
def update_roles(arg=None):
	"""update set and unset roles"""
	# remove roles
	unset = json.loads(webnotes.form_dict['unset_roles'])
	webnotes.conn.sql("""delete from tabUserRole where parent='%s' 
		and role in ('%s')""" % (webnotes.form_dict['uid'], "','".join(unset)))

	# check for 1 system manager
	if not webnotes.conn.sql("""select parent from tabUserRole where role='System Manager'
		and docstatus<2"""):
		webnotes.msgprint("Sorry there must be atleast one 'System Manager'")
		raise webnotes.ValidationError

	# add roles
	roles = get_user_roles()
	toset = json.loads(webnotes.form_dict['set_roles'])
	for role in toset:
		if not role in roles:
			d = Document('UserRole')
			d.role = role
			d.parent = webnotes.form_dict['uid']
			d.save()
	
	webnotes.msgprint('Roles Updated')

@webnotes.whitelist()
def update_security(args=''):
	args = json.loads(args)
	webnotes.conn.set_value('Profile', args['user'], 'restrict_ip', args.get('restrict_ip'))
	webnotes.conn.set_value('Profile', args['user'], 'login_after', args.get('login_after'))
	webnotes.conn.set_value('Profile', args['user'], 'login_before', args.get('login_before'))
	webnotes.conn.set_value('Profile', args['user'], 'enabled', int(args.get('enabled',0)) or 0)

	if args.get('new_password') and args.get('sys_admin_pwd'):
		if cint(webnotes.conn.get_value('Control Panel',None,'sync_with_gateway')):
			import server_tools.gateway_utils
			res = server_tools.gateway_utils.change_password('', args['new_password'], 
				args['user'], args['sys_admin_pwd'])
			if 'Traceback' not in res['message']:
				webnotes.msgprint(res['message'])
		webnotes.conn.sql("update tabProfile set password=password(%s) where name=%s", 
			(args['new_password'], args['user']))
	else: 
		webnotes.msgprint('Settings Updated')



#
# user addition
#

@webnotes.whitelist()
def add_user(args):
	args = json.loads(args)
	# erpnext-saas
	if cint(webnotes.conn.get_value('Control Panel', None, 'sync_with_gateway')):
		from server_tools.gateway_utils import add_user_gateway
		add_user_gateway(args)
	
	add_profile(args)
	
@webnotes.whitelist()
def add_profile(args):
	from webnotes.utils import validate_email_add, now
	email = args['user']
			
	sql = webnotes.conn.sql
	
	if not email:
		email = webnotes.form_dict.get('user')
	if not validate_email_add(email):
		raise Exception
		return 'Invalid Email Id'
	
	if sql("select name from tabProfile where name = %s", email):
		# exists, enable it
		sql("update tabProfile set enabled = 1, docstatus=0 where name = %s", email)
		webnotes.msgprint('Profile exists, enabled it with new password')
	else:
		# does not exist, create it!
		pr = Document('Profile')
		pr.name = email
		pr.email = email
		pr.first_name = args.get('first_name')
		pr.last_name = args.get('last_name')
		pr.enabled = 1
		pr.user_type = 'System User'
		pr.save(1)

	if args.get('password'):
		sql("""
			UPDATE tabProfile 
			SET password = PASSWORD(%s), modified = %s
			WHERE name = %s""", (args.get('password'), now, email))

	send_welcome_mail(email, args)

@webnotes.whitelist()
def send_welcome_mail(email, args):
	"""send welcome mail to user with password and login url"""
	pr = Document('Profile', email)
	from webnotes.utils.email_lib import sendmail_md
	args.update({
		'company': webnotes.conn.get_default('company'),
		'password': args.get('password'),
		'account_url': webnotes.conn.get_value('Website Settings',
			'Website Settings', 'subdomain') or ""
	})
	if not args.get('last_name'): args['last_name'] = ''
	sendmail_md(pr.email, subject="Welcome to ERPNext", msg=welcome_txt % args, from_defs=1)

#
# delete user
#
@webnotes.whitelist()
def delete(arg=None):
	"""delete user"""
	webnotes.conn.sql("update tabProfile set enabled=0, docstatus=2 where name=%s", 
		webnotes.form_dict['uid'])
	# erpnext-saas
	if int(webnotes.conn.get_value('Control Panel', None, 'sync_with_gateway')):
		from server_tools.gateway_utils import remove_user_gateway
		remove_user_gateway(webnotes.form_dict['uid'])

	webnotes.login_manager.logout(user=webnotes.form_dict['uid'])
	
welcome_txt = """
## %(company)s

Dear %(first_name)s %(last_name)s

Welcome!

A new account has been created for you, here are your details:

login-id: %(user)s
password: %(password)s

To login to your new ERPNext account, please go to:

%(account_url)s
"""
