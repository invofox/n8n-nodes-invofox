import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class InvofoxApi implements ICredentialType {
	name = 'invofoxApi';

	displayName = 'Invofox API';

	icon = {
		light: 'file:../nodes/Invofox/invofox.svg',
		dark: 'file:../nodes/Invofox/invofox.dark.svg',
	} as const;

	documentationUrl = 'https://developers.invofox.com/api-reference';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description:
				'Your Invofox API key. Sent as the x-api-key header on every request. You can generate one from the Invofox dashboard.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.invofox.com',
			description: 'Base URL of the Invofox API. Change this only for non-production environments.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/documents',
			method: 'GET',
			qs: {
				limit: 1,
			},
		},
	};
}
