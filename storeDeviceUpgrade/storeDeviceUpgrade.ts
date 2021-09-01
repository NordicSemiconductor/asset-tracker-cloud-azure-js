import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
import { v4 } from 'uuid'
import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { fromEnv } from '../lib/fromEnv.js'

const { fotaStorageAccountName, fotaStorageAccessKey } = fromEnv({
	fotaStorageAccountName: 'FOTA_STORAGE_ACCOUNT_NAME',
	fotaStorageAccessKey: 'FOTA_STORAGE_ACCESS_KEY',
})(process.env)
const fotaStorageContainer = 'upgrades'

const sharedKeyCredential = new StorageSharedKeyCredential(
	fotaStorageAccountName,
	fotaStorageAccessKey,
)
const blobServiceClient = new BlobServiceClient(
	`https://${fotaStorageAccountName}.blob.core.windows.net`,
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
		fotaStorageAccountName,
		fotaStorageAccessKey,
		bodyLength: body.length,
	})
	try {
		const id = v4()
		const blobName = `${id}.bin`
		const blockBlobClient = containerClient.getBlockBlobClient(blobName)
		const file = Buffer.from(body, 'base64')
		await blockBlobClient.upload(file, file.length, {
			blobHTTPHeaders: {
				blobContentType: 'text/octet-stream',
				blobCacheControl: 'public, max-age=31536000',
			},
		})
		const url = `https://${fotaStorageAccountName}.blob.core.windows.net/${fotaStorageContainer}/${blobName}`
		log(context)(`Upload block blob ${blobName} successfully`, url)
		context.res = result(context)({ success: true, url })
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default storeDeviceUpgrade
