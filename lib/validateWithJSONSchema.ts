import { Static, TObject, TProperties } from '@sinclair/typebox'
import Ajv from 'ajv'
import { ErrorInfo, ErrorType } from './ErrorInfo.js'

export const validateWithJSONSchema = <T extends TObject<TProperties>>(
	schema: T,
): ((
	value: Record<string, any>,
) => { error: ErrorInfo } | Static<typeof schema>) => {
	const ajv = new Ajv()
	// see @https://github.com/sinclairzx81/typebox/issues/51
	ajv.addKeyword('kind')
	ajv.addKeyword('modifier')
	const v = ajv.compile(schema)
	return (value: Record<string, any>) => {
		const valid = v(value)
		if (valid !== true) {
			return {
				error: {
					type: ErrorType.BadRequest,
					message: 'Validation failed!',
					detail: {
						errors: v.errors,
						input: value,
					},
				},
			}
		}
		return value as Static<typeof schema>
	}
}
