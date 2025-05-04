import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LinkedInBrowser implements ICredentialType {
	name = 'linkedInBrowser';
	displayName = 'LinkedIn Browser';
	documentationUrl = 'https://linkedin.com/developers';
	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'LinkedIn username or email',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'LinkedIn password',
		},
		{
			displayName: 'Use 2FA',
			name: 'use2FA',
			type: 'boolean',
			default: false,
			description: 'Whether to use two-factor authentication',
		},
		{
			displayName: '2FA Code',
			name: 'twoFactorCode',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					use2FA: [true],
				},
			},
			description: 'Two-factor authentication code',
		},
		{
			displayName: 'Session Cookie Storage',
			name: 'sessionCookieStorage',
			type: 'boolean',
			default: true,
			description: 'Whether to store session cookies for faster reconnection',
		},
		{
			displayName: 'Headless Browser',
			name: 'headless',
			type: 'boolean',
			default: true,
			description: 'Whether to run browser in headless mode',
		},
	];
	
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};
}