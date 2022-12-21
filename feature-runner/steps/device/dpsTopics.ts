import { randomUUID } from 'node:crypto'

export const dpsTopics = {
	registrationResponses: '$dps/registrations/res/#',
	register: (): string =>
		`$dps/registrations/PUT/iotdps-register/?$rid=${randomUUID()}`,
	registationStatus: (operationId: string): string =>
		`$dps/registrations/GET/iotdps-get-operationstatus/?$rid=${randomUUID()}&operationId=${operationId}`,
	registrationResult: (status: number): string =>
		`$dps/registrations/res/${status}`,
}
