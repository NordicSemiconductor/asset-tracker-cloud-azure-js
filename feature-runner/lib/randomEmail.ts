import { randomUUID } from 'node:crypto'

export const randomEmail = (): string => `${randomUUID()}@example.com`
