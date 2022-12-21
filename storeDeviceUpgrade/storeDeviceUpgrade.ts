import { AzureFunction, Context, HttpRequest } from '@azure/functions'
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
const fotaStorageContainer = 'upgrades'

const sharedKeyCredential = new StorageSharedKeyCredential(
	storageAccountName,
	storageAccessKey,
)
const blobServiceClient = new BlobServiceClient(
	`https://${storageAccountName}.blob.core.windows.net`,
	sharedKeyCredential,
)
const containerClient =
	blobServiceClient.getContainerClient(fotaStorageContainer)

const storeDeviceUpgrade: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	const { body } = req
	log(context)({
		storageAccountName,
		storageAccessKey,
		bodyLength: body.length,
	})
	try {
		const id = randomUUID()
		const blobName = `${id}.bin`
		const blockBlobClient = containerClient.getBlockBlobClient(blobName)
		const file = Buffer.from(body, 'base64')
		await blockBlobClient.upload(file, file.length, {
			blobHTTPHeaders: {
				blobContentType: 'text/octet-stream',
				blobCacheControl: 'public, max-age=31536000',
			},
		})
		const url = `https://${storageAccountName}.blob.core.windows.net/${fotaStorageContainer}/${blobName}`
		log(context)(`Upload block blob ${blobName} successfully`, url)
		context.res = result(context)({ success: true, url })
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default storeDeviceUpgrade
