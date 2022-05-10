import fastify from 'fastify';
import cors from 'fastify-cors';
import validator from './plugins/validator';
import { relayerHandler } from './routes';


function createServer() {
  const server = fastify({
    logger: true,
    pluginTimeout: 5000,
    bodyLimit: 1048576, // 1 mb
  });
  server.register(cors);
  server.register(validator);
  server.register(relayerHandler);


  server.setErrorHandler((error, req, res) => {
    req.log.error(error.toString());
    res.code(500).send({ error });
  });
  return server;
}

export default createServer;
