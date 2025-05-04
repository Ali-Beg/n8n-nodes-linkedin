import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LinkedInApi implements ICredentialType {
	name = 'linkedInApi';
	displayName = 'LinkedIn API';
	documentationUrl = 'https://docs.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin';
	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'The client ID of your LinkedIn application',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'The client secret of your LinkedIn application',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'LinkedIn OAuth2 access token',
		},
		{
			displayName: 'Redirect URI',
			name: 'redirectUri',
			type: 'string',
			default: '',
			description: 'Your OAuth2 redirect URI for LinkedIn',
		},
		{
			displayName: 'Use Self-Managed OAuth2 Flow',
			name: 'selfManagedOAuth',
			type: 'boolean',
			default: false,
			description: 'Whether to use a self-managed OAuth2 flow for authentication',
		},
	];
}