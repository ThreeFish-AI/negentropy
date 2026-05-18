import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup requests interception using the given handlers.
// Default to two handlers: papers and auth
export const server = setupServer(...handlers)