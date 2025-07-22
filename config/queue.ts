import env from '#start/env'

const queueConfig = {
  /*
  |--------------------------------------------------------------------------
  | Default queue connection
  |--------------------------------------------------------------------------
  |
  | The default connection for queuing jobs.
  |
  */
  connection: 'redis',

  /*
  |--------------------------------------------------------------------------
  | Queue connections
  |--------------------------------------------------------------------------
  |
  | Connections for different queuing services.
  |
  */
  connections: {
    redis: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD'),
    },
  },
}

export default queueConfig
