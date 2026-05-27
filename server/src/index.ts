import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { initSocket } from './socket';
import { router } from './routes';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());
app.use('/api', router);

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Kingdom Quarrels server running on http://localhost:${PORT}`);
});
