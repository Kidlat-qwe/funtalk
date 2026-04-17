import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/config.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { query } from './config/database.js';
import { ensureSubscriptionSchema } from './services/billingSubscriptionService.js';
import { ensureNotificationSchema } from './services/notificationService.js';
import { dispatchInvoiceDueReminders, dispatchUpcomingClassReminders } from './services/notificationDispatchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.port;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Test database connection on startup
const testDatabaseConnection = async () => {
  try {
    await query('SELECT NOW()');
    console.log('✅ Database connection test successful');
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    process.exit(1);
  }
};

const ensureTeacherSchema = async () => {
  await query(
    `ALTER TABLE teachertbl
     ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) NOT NULL DEFAULT 'part_time'`
  );
  await query(
    `ALTER TABLE teachertbl
     DROP CONSTRAINT IF EXISTS teachertbl_employment_type_check`
  );
  await query(
    `ALTER TABLE teachertbl
     ADD CONSTRAINT teachertbl_employment_type_check
     CHECK (employment_type IN ('part_time', 'full_time'))`
  );
};

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Funtalk Platform API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testDatabaseConnection();
    await ensureSubscriptionSchema();
    console.log('✅ Billing subscription schema ready');
    await ensureNotificationSchema();
    console.log('✅ Notification schema ready');
    await ensureTeacherSchema();
    console.log('✅ Teacher schema ready');

    const runNotificationSweep = async () => {
      try {
        await dispatchUpcomingClassReminders();
        await dispatchInvoiceDueReminders();
      } catch (error) {
        console.error('Notification sweep failed:', error.message);
      }
    };
    await runNotificationSweep();
    setInterval(runNotificationSweep, 60 * 1000);
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

