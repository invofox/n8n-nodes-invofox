# n8n-nodes-invofox

This is an n8n community node. It lets you use [Invofox](https://invofox.com/) in your n8n workflows.

Invofox is a document intelligence platform that extracts structured data from invoices, receipts and other documents using AI. With this node you can upload one or more files for processing and retrieve the extracted data of a document.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In short: go to **Settings > Community Nodes**, select **Install**, and enter `n8n-nodes-invofox`.

## Operations

The node exposes a single **Document** resource with the following operations:

- **Upload** — Upload one or more binary files to Invofox for processing. You can send several files in a single request and optionally attach metadata (type, classifier, splitter, company and custom data). Supported formats: JPEG, JPG, PNG, TIFF, PDF and ZIP (max 100 MB per request).
- **Upload by URL** — Upload one or more files by their public URL (no binary data needed), with the same metadata options. Ideal when your files already live in S3, Google Drive, etc.
- **Get** — Retrieve a document by its ID, including its processing status (`publicState`), confidence and extracted `data`. Use the **Simplify** toggle to return only the most relevant fields.

For uploads you must either provide a **Type** (the Invofox model ID used to process the document) or enable **Use Classifier** so Invofox detects the type automatically.

## Credentials

You need an Invofox account and an API key.

1. Sign in to your Invofox dashboard and generate an API key.
2. In n8n, create new **Invofox API** credentials and paste your API key.

The API key is sent as the `x-api-key` header on every request. The credential includes a test that calls the Invofox API so you can confirm the key is valid before running a workflow.

## Compatibility

- Requires n8n 1.x and Node.js 20 or newer.
- Tested against the Invofox API (`https://api.invofox.com`).

## Usage

A typical flow is:

1. Read a file (for example with the **Read/Write Files from Disk** or **HTTP Request** node) so it is available as binary data on the item.
2. Add the **Invofox** node with the **Upload** operation, pointing **Input Binary Field(s)** at the binary property name(s). To send several files in one request, separate their names with commas.
3. Take the `documentId` returned for a file and, once processing has finished, use the **Get** operation to fetch the extracted data.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Invofox API reference](https://developers.invofox.com/api-reference)
