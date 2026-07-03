import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, jsonParse } from 'n8n-workflow';

const DEFAULT_BASE_URL = 'https://api.invofox.com';

export class Invofox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Invofox',
		name: 'invofox',
		icon: { light: 'file:invofox.svg', dark: 'file:invofox.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload documents to Invofox and retrieve their extracted data',
		defaults: {
			name: 'Invofox',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'invofoxApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a document with its processing status and extracted data',
						action: 'Get a document',
					},
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload one or more binary files to Invofox for processing',
						action: 'Upload a document',
					},
					{
						name: 'Upload by URL',
						value: 'uploadByUrl',
						description: 'Upload one or more files to Invofox by their public URL',
						action: 'Upload a document by URL',
					},
				],
				default: 'upload',
			},

			// ----------------------------------
			//               upload
			// ----------------------------------
			{
				displayName: 'Input Binary Field(s)',
				name: 'binaryPropertyNames',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: ['upload'],
					},
				},
				description:
					'Name of the binary field(s) that hold the files to upload. Separate multiple names with a comma to send several files in a single request. Supported formats: JPEG, JPG, PNG, TIFF, PDF and ZIP (max 100 MB per request).',
				placeholder: 'data',
			},
			{
				displayName: 'File URLs',
				name: 'fileUrls',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['uploadByUrl'],
					},
				},
				description:
					'Public URL(s) of the file(s) to upload. Add one URL per line (or separate them with commas) to send several files in a single request.',
				placeholder: 'https://example.com/invoice.pdf',
			},
			{
				displayName: 'Type (Invofox Model ID)',
				name: 'type',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['upload', 'uploadByUrl'],
					},
					hide: {
						useClassifier: [true],
					},
				},
				hint: 'The Invofox model ID used to process the document',
				description:
					'ID of the Invofox model used to process the document. Not needed when "Use Classifier" is enabled, as Invofox will then detect the type automatically.',
			},
			{
				displayName: 'Use Classifier',
				name: 'useClassifier',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['upload', 'uploadByUrl'],
					},
				},
				description:
					'Whether to let Invofox detect the document type automatically with the classifier. When enabled, the Type field is hidden and ignored.',
			},
			{
				displayName: 'Use Splitter',
				name: 'useSplitter',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['upload', 'uploadByUrl'],
					},
				},
				description:
					'Whether to let Invofox split a file into several documents (ignored if the splitter is not enabled for the environment)',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						operation: ['upload', 'uploadByUrl'],
					},
				},
				options: [
					{
						displayName: 'Client Data (JSON)',
						name: 'clientData',
						type: 'json',
						default: '',
						description: 'Custom metadata for your own application, as a JSON object',
					},
					{
						displayName: 'Company ID',
						name: 'company',
						type: 'string',
						default: '',
						description: 'ID of the company the document(s) belong to',
					},
					{
						displayName: 'Data (JSON)',
						name: 'data',
						type: 'json',
						default: '',
						description: 'Known metadata about the document(s), as a JSON object',
					},
				],
			},

			// ----------------------------------
			//                get
			// ----------------------------------
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['get'],
					},
				},
				description: 'ID of the document to retrieve',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['get'],
					},
				},
				description:
					'Whether to return a simplified version of the document with only the most relevant fields instead of the full raw response',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('invofoxApi');
		const baseURL = ((credentials.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject;

				if (operation === 'upload' || operation === 'uploadByUrl') {
					const type = (this.getNodeParameter('type', i, '') as string).trim();
					const useClassifier = this.getNodeParameter('useClassifier', i, false) as boolean;
					const useSplitter = this.getNodeParameter('useSplitter', i, false) as boolean;
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					if (type === '' && !useClassifier) {
						throw new NodeOperationError(
							this.getNode(),
							'Provide a Type (model ID) or enable "Use Classifier" so Invofox can detect the document type',
							{ itemIndex: i },
						);
					}

					const info = buildInfoPayload({
						type: useClassifier ? '' : type,
						useClassifier,
						useSplitter,
						...additionalFields,
					});

					if (operation === 'upload') {
						const binaryPropertyNames = (this.getNodeParameter('binaryPropertyNames', i) as string)
							.split(',')
							.map((name) => name.trim())
							.filter((name) => name !== '');

						if (binaryPropertyNames.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'At least one binary field name must be provided',
								{ itemIndex: i },
							);
						}

						const formData = new FormData();
						for (const propertyName of binaryPropertyNames) {
							const binaryData = this.helpers.assertBinaryData(i, propertyName);
							const buffer = await this.helpers.getBinaryDataBuffer(i, propertyName);
							formData.append(
								'files',
								new Blob([buffer], { type: binaryData.mimeType }),
								binaryData.fileName ?? propertyName,
							);
						}
						formData.append('info', JSON.stringify(info));

						responseData = (await this.helpers.httpRequestWithAuthentication.call(this, 'invofoxApi', {
							method: 'POST',
							baseURL,
							url: '/v1/ingest/uploads',
							body: formData,
						})) as IDataObject;
					} else {
						const urls = (this.getNodeParameter('fileUrls', i) as string)
							.split(/[\n,]/)
							.map((url) => url.trim())
							.filter((url) => url !== '');

						if (urls.length === 0) {
							throw new NodeOperationError(this.getNode(), 'Provide at least one file URL', {
								itemIndex: i,
							});
						}

						// `company` is applied at the batch level; the rest of the info is per file.
						const { company, ...perFileInfo } = info;
						const body: IDataObject = {
							files: urls.map((url) => ({ url, info: perFileInfo })),
						};
						if (company !== undefined) {
							body.info = { company };
						}

						responseData = (await this.helpers.httpRequestWithAuthentication.call(this, 'invofoxApi', {
							method: 'POST',
							baseURL,
							url: '/v1/ingest/by-url',
							body,
							json: true,
						})) as IDataObject;
					}
				} else if (operation === 'get') {
					const documentId = this.getNodeParameter('documentId', i) as string;
					const simplify = this.getNodeParameter('simplify', i) as boolean;

					const options: IHttpRequestOptions = {
						method: 'GET',
						baseURL,
						url: `/documents/${encodeURIComponent(documentId)}`,
					};

					const document = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'invofoxApi',
						options,
					)) as IDataObject;

					responseData = simplify ? simplifyDocument(document) : document;
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported`,
						{ itemIndex: i },
					);
				}

				returnData.push({
					json: responseData,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

function buildInfoPayload(fields: IDataObject): IDataObject {
	const payload: IDataObject = {
		useSplitter: fields.useSplitter === true,
	};

	if (typeof fields.type === 'string' && fields.type !== '') {
		payload.type = fields.type;
	}
	if (fields.useClassifier === true) {
		payload.useClassifier = true;
	}
	if (typeof fields.company === 'string' && fields.company !== '') {
		payload.company = fields.company;
	}

	const data = parseJsonField(fields.data);
	if (data !== undefined) {
		payload.data = data;
	}
	const clientData = parseJsonField(fields.clientData);
	if (clientData !== undefined) {
		payload.clientData = clientData;
	}

	return payload;
}

function parseJsonField(value: unknown): IDataObject | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed =
		typeof value === 'string' ? jsonParse<IDataObject>(value) : (value as IDataObject);
	if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
		return parsed;
	}
	return undefined;
}

function simplifyDocument(response: IDataObject): IDataObject {
	// The API wraps the document inside a `result` object.
	const document = (response.result as IDataObject) ?? response;
	return {
		id: document._id,
		type: document.type,
		name: document.name,
		publicState: document.publicState,
		confidence: document.confidence,
		company: document.company,
		creation: document.creation,
		data: document.data,
	};
}
