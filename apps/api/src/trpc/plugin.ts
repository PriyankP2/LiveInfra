import type { FastifyPluginAsync } from 'fastify'
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify'
import { appRouter, type AppRouter } from './router.js'

export const trpcPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyTRPCPlugin, {
    prefix: '',
    trpcOptions: {
      router: appRouter,
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>)
}
