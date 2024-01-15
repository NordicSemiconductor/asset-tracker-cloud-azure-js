import type { Static, TSchema } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ErrorInfo, ErrorType } from './ErrorInfo.js'

/**
 * Validate the value against the given TypeBox schema
 */
export const validate = <T extends TSchema>(
	schema: T,
): ((value: unknown) =>
	| { value: Static<typeof schema> }
	| {
			error: ErrorInfo
	  }) => {
	const C = TypeCompiler.Compile(schema)
	return (value: unknown) => {
		const firstError = C.Errors(value).First()
		if (firstError !== undefined) {
			return {
				error: {
					type: ErrorType.BadRequest,
					message: 'Validation failed!',
					detail: {
						errors: [...C.Errors(value)],
						input: value,
					},
				},
			}
		}
		return { value: value as Static<typeof schema> }
	}
}
