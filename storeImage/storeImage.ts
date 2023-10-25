import type { HttpHandler } from '@azure/functions'
import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { randomUUID } from 'node:crypto'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'

const { storageAccountName, storageAccessKey } = fromEnv({
	storageAccountName: 'STORAGE_ACCOUNT_NAME',
	storageAccessKey: 'STORAGE_ACCESS_KEY',
})(process.env)
const avatarStorageContainer = 'avatars'

const sharedKeyCredential = new StorageSharedKeyCredential(
	storageAccountName,
	storageAccessKey,
)
const blobServiceClient = new BlobServiceClient(
	`https://${storageAccountName}.blob.core.windows.net`,
	sharedKeyCredential,
)
const containerClient = blobServiceClient.getContainerClient(
	avatarStorageContainer,
)

const storeImage: HttpHandler = async (req, context) => {
	const body = await req.text()
	log(context)({
		req: { query: Object.fromEntries(req.query), params: req.params },
		storageAccountName,
		storageAccessKey,
		bodyLength: body.length,
	})

	const image = Buffer.from(body, 'base64')
	const blobName = `${randomUUID()}.jpg`
	const blockBlobClient = containerClient.getBlockBlobClient(blobName)
	const uploadBlobResponse = await blockBlobClient.upload(image, image.length, {
		blobHTTPHeaders: {
			blobContentType: 'image/jpeg',
			blobCacheControl: 'public, max-age=31536000',
		},
	})
	log(context)(
		`Upload block blob ${blobName} successfully`,
		uploadBlobResponse.requestId,
	)

	return result(context)(
		{
			url: `https://${storageAccountName}.blob.core.windows.net/${avatarStorageContainer}/${blobName}`,
		},
		202,
	)
}

export default storeImage
