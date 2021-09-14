export type TwinChangeEvent = {
	version: number
	tags?: Record<string, any>
	properties?: {
		desired?: Record<string, any>
		reported?: Record<string, any>
	}
}

export type DeviceMessage = Record<
	string,
	{
		v: any
		ts: number
	}
>

export type BatchDeviceUpdate = Record<
	string,
	{
		v: any
		ts: number
	}[]
>

export type DeviceUpdate = TwinChangeEvent | DeviceMessage

export type AGPSRequest = {
	mcc: number
	mnc: number
	cell: number
	area: number
	types: number[]
}
