import { v4 } from 'uuid'

export const dpsTopics = {
	registrationResponses: '$dps/registrations/res/#',
	register: (): string =>
		`$dps/registrations/PUT/iotdps-register/?$rid=${v4()}`,
	registationStatus: (operationId: string): string =>
		`$dps/registrations/GET/iotdps-get-operationstatus/?$rid=${v4()}&operationId=${operationId}`,
	registrationResult: (status: number): string =>
		`$dps/registrations/res/${status}`,
}
