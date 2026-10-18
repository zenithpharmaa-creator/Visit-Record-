/**
 * Production-Ready Full-Stack Server
 * Field Visit Tracker API Gateway & Vite Dev Server Middleware
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { serverDb, PERMISSION_DEFINITIONS } from './src/db/serverDb.js';
import { UserRole } from './src/types/index.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'field-visit-tracker-super-secret-jwt-key-2026';
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware: Authenticate JWT Token
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    assignedRegion: string;
  };
}

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح: توكن المصادقة مفقود' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'غير مصرح: توكن غير صالح أو منتهي الصلاحية' });
    }
    req.user = decoded;
    next();
  });
};

// Middleware: Role-Based Access Control (RBAC)
const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'عذراً، ليس لديك الصلاحيات الكافية لتنفيذ هذا الإجراء' });
    }
    next();
  };
};

// --- GITHUB OAUTH INTEGRATION ROUTES ---
app.get('/api/auth/github/url', (req: Request, res: Response) => {
  const queryClientId = req.query.client_id as string;
  const rawClientId = queryClientId || process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID || '';
  const clientId = rawClientId.trim().replace(/^['"]|['"]$/g, '');
  
  if (!clientId || clientId === 'GITHUB_CLIENT_ID_PLACEHOLDER') {
    return res.status(400).json({ error: 'INVALID_CLIENT_ID', message: 'Client ID is missing or invalid' });
  }

  // Get protocol and host reliably
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'ais-dev-gg2b2vz3woxxeevhjzru3w-53432909942.europe-west2.run.app';
  const origin = `${protocol}://${host}`;
  const redirectUri = `${origin}/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return res.json({ url: authUrl, redirectUri, origin, clientId });
});

const githubCallbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.CLIENT_SECRET;

  let githubUser: any = null;

  if (code && clientId && clientSecret) {
    try {
      // Exchange code for token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        // Fetch user profile
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'User-Agent': 'FieldVisitTracker-App',
          },
        });
        githubUser = await userRes.json();
      }
    } catch (err) {
      console.error('[GitHub OAuth] Token exchange error:', err);
    }
  }

  // HTML response returning message to opener popup window
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>تم الاتصال بـ GitHub</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 400px; }
          h2 { color: #38bdf8; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>تم الاتصال بـ GitHub بنجاح!</h2>
          <p>جاري العودة إلى تطبيق Field Visit Tracker...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_AUTH_SUCCESS',
              provider: 'github',
              user: ${JSON.stringify(githubUser || { login: 'GitHubUser' })}
            }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
};

app.get('/auth/github/callback', githubCallbackHandler);
app.get('/auth/github/callback/', githubCallbackHandler);
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, email, identifier, password } = req.body;
  const loginIdentifier = (identifier || email || username || '').trim();

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور' });
  }

  const user = serverDb.getUserByUsernameOrEmail(loginIdentifier);
  if (!user || !user.isActive || !user.passwordHash) {
    return res.status(401).json({ error: 'بيانات الدخول أو كلمة المرور غير صحيحة، أو الحساب معطل' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'بيانات الدخول أو كلمة المرور غير صحيحة' });
  }

  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    assignedRegion: user.assignedRegion,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

  // Add Audit Log
  serverDb.addAuditLog({
    userId: user.id,
    role: user.role,
    action: 'USER_LOGIN',
    entityType: 'AUTH',
    entityId: user.id,
    timestamp: new Date().toISOString(),
    metadata: { username: user.username, email: user.email, role: user.role, loginIdentifier },
  });

  return res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      assignedRegion: user.assignedRegion,
      customPermissions: user.customPermissions || [],
    },
    configVersion: serverDb.getConfiguration().configVersion,
  });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = serverDb.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    assignedRegion: user.assignedRegion,
  });
});

// --- CUSTOMERS DELTA SYNC & MANAGEMENT ---
app.get('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const sinceVersion = parseInt((req.query.sinceVersion as string) || '0', 10);
  const region = (req.query.region as string) || req.user?.assignedRegion;
  const repId = req.user?.role === 'SALES_REP' ? req.user.id : undefined;

  const customers = serverDb.getCustomersDelta(sinceVersion, region, repId);
  const currentMaxVersion = Math.max(0, ...customers.map(c => c.version));

  return res.json({
    serverTime: new Date().toISOString(),
    latestVersion: currentMaxVersion,
    customers,
  });
});

app.post('/api/customers', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { customerCode, customerName, ownerName, phone, address, region, latitude, longitude, allowedVisitRadiusMeters, isActive, assignedRepId } = req.body;

  if (!customerCode || !customerName) {
    return res.status(400).json({ error: 'يرجى توفير كود العميل واسم العميل' });
  }

  // Preserve customerCode leading zeros as strict string!
  const savedCustomer = serverDb.upsertCustomer(
    {
      id: req.body.id,
      customerCode: String(customerCode),
      customerName,
      ownerName,
      phone,
      address,
      region,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      allowedVisitRadiusMeters: parseFloat(allowedVisitRadiusMeters) || 100,
      assignedRepId: assignedRepId || '',
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    },
    req.user!.id
  );

  return res.json({
    message: 'تم حفظ بيانات العميل وتحديث الإصدار المركزي بنجاح',
    customer: savedCustomer,
  });
});

app.post('/api/customers/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { customers, clients } = req.body;
  const list = customers || clients;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'قائمة العملاء غير صالحة' });
  const result = serverDb.bulkImportClients(list, req.user!.id);
  return res.json({
    message: `تم استيراد ${result.total} عميل بنجاح للسجل المركزي (جديد: ${result.created}، تم التحديث: ${result.updated})`,
    result,
  });
});

app.delete('/api/customers/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const deleted = serverDb.deleteCustomer(req.params.id, req.user!.id);
  return res.json({ success: deleted, message: deleted ? 'تم حذف العميل بنجاح من السجل المركزي' : 'العميل غير موجود' });
});

// --- VISITS BATCH IDEMPOTENT SYNC ---
app.post('/api/visits/sync', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { visits } = req.body;

  if (!Array.isArray(visits)) {
    return res.status(400).json({ error: 'قائمة الزيارات غير صالحة' });
  }

  const result = serverDb.syncVisitsBatch(visits, req.user!.id);

  return res.json({
    syncedVisitIds: result.syncedVisitIds,
    failedVisitIds: result.failedVisitIds,
    serverReceivedTimestamp: new Date().toISOString(),
  });
});

app.get('/api/visits', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { date, userId, region, locationStatus } = req.query;

  const visits = serverDb.getVisits({
    date: date as string,
    userId: userId as string,
    region: region as string,
    locationStatus: locationStatus as string,
  });

  return res.json({ visits });
});

// --- SERVER-DRIVEN CONFIGURATION ---
app.get('/api/configuration', (req: Request, res: Response) => {
  const config = serverDb.getConfiguration();
  return res.json(config);
});

app.post('/api/configuration', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const updatedConfig = serverDb.updateConfiguration(req.body, req.user!.id);
  return res.json({
    message: 'تم تحديث إعدادات النظام وتحديث التنسيق المركزي بنجاح',
    configuration: updatedConfig,
  });
});

// --- USERS & REPS MANAGEMENT (المندوبون، المشرفون، مدراء النظام) ---
app.get('/api/users', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: Request, res: Response) => {
  const users = serverDb.getAllUsersAdmin();
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    phone: u.phone,
    assignedRegion: u.assignedRegion,
    assignedRegionIds: u.assignedRegionIds || [],
    assignedProductIds: u.assignedProductIds || [],
    customPermissions: u.customPermissions || [],
    isActive: u.isActive,
    createdAt: u.createdAt,
    version: u.version,
  }));
  return res.json({ users: safeUsers });
});

app.post('/api/users', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { id, username, email, password, fullName, role, phone, assignedRegion, assignedRegionIds, assignedProductIds, isActive, customPermissions } = req.body;

  if (id) {
    // Update existing user (مندوب / مشرف / مدير نظام)
    const updated = serverDb.updateUser(
      id,
      { username, email, fullName, role, phone, assignedRegion, assignedRegionIds, assignedProductIds, isActive, customPermissions, password },
      req.user!.id
    );
    return res.json({ message: 'تم حفظ وتحديث بيانات المستخدم بنجاح', user: updated });
  } else {
    // Create new user
    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ error: 'يرجى توفير جميع البيانات الأساسية: اسم المستخدم، كلمة المرور، الاسم الكامل، والدور' });
    }
    const newUser = serverDb.createUser(
      {
        username,
        email: email || '',
        fullName,
        role,
        phone: phone || '',
        assignedRegion: assignedRegion || 'صنعاء - التحرير والزبيري',
        assignedRegionIds: assignedRegionIds || [],
        assignedProductIds: assignedProductIds || [],
        customPermissions: customPermissions || [],
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      password,
      req.user!.id
    );
    return res.json({ message: 'تم إنشاء المستخدم وحفظه بنجاح', user: newUser });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;
  const result = serverDb.deleteUser(userId, req.user!.id);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }
  return res.json({ success: true, message: result.message });
});

// --- PERMISSIONS MANAGEMENT (صفحة الصلاحيات) ---
app.get('/api/permissions', authenticateToken, (req: Request, res: Response) => {
  const permissions = serverDb.getPermissions();
  return res.json({
    permissions,
    definitions: PERMISSION_DEFINITIONS,
  });
});

app.post('/api/permissions', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'مصفوفة الصلاحيات غير صالحة' });
  }
  const updated = serverDb.updatePermissions(permissions, req.user!.id);
  return res.json({ message: 'تم حفظ وتطبيق مصفوفة الصلاحيات المركزية بنجاح!', permissions: updated });
});

app.post('/api/permissions/reset', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const resetMatrix = serverDb.resetPermissions(req.user!.id);
  return res.json({ message: 'تمت استعادة الصلاحيات الافتراضية بنجاح', permissions: resetMatrix });
});

app.post('/api/users/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'قائمة المناديب غير صالحة' });
  const result = serverDb.bulkImportUsers(users, req.user!.id);
  return res.json({ message: `تم استيراد ${result.total} مستخدم بنجاح (جديد: ${result.created}، تم التحديث: ${result.updated})`, result });
});

app.post('/api/users/:id/assignments', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;
  const { assignedRegion, assignedRegionIds, assignedProductIds } = req.body;
  const updated = serverDb.updateUserAssignments(userId, { assignedRegion, assignedRegionIds, assignedProductIds }, req.user!.id);
  return res.json({ message: 'تم تحديث تعيينات المندوب بنجاح', user: updated });
});

// --- REGIONS (المناطق) API ---
app.get('/api/regions', authenticateToken, (req: Request, res: Response) => {
  const regions = serverDb.getAllRegions();
  return res.json({ regions });
});

app.post('/api/regions', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { id, code, name, section, governorate, description, boundaryBasis, agreedBoundaries, teamAgreement, approvedByAdmin, assignedRepIds, isActive } = req.body;
  if (!id && (!code || !name)) {
    return res.status(400).json({ error: 'يرجى إدخال كود واسم المنطقة' });
  }
  const region = serverDb.upsertRegion({ id, code, name, section, governorate, description, boundaryBasis, agreedBoundaries, teamAgreement, approvedByAdmin, assignedRepIds, isActive }, req.user!.id);
  return res.json({ message: 'تم حفظ المنطقة وتحديث حدودها بنجاح', region });
});

app.post('/api/regions/reset-team-agreement', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const regions = serverDb.resetRegionsToTeamAgreement(req.user!.id);
  return res.json({ message: 'تم إعادة ضبط المناطق وحدودها بنجاح وفق اتفاق أعضاء الفريق واعتماد مدير النظام', regions });
});

app.post('/api/regions/:id/assign', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { assignedRepIds, repIds } = req.body;
  const targetIds = Array.isArray(assignedRepIds) ? assignedRepIds : (Array.isArray(repIds) ? repIds : []);
  const region = serverDb.assignRegionReps(req.params.id, targetIds, req.user!.id);
  return res.json({ message: 'تم حفظ وتحديث تعيين المناديب للمنطقة بنجاح', region });
});

app.delete('/api/regions/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const deleted = serverDb.deleteRegion(req.params.id, req.user!.id);
  return res.json({ success: deleted, message: deleted ? 'تم حذف المنطقة بنجاح' : 'المنطقة غير موجودة' });
});

app.post('/api/regions/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { regions } = req.body;
  if (!Array.isArray(regions)) return res.status(400).json({ error: 'قائمة المناطق غير صالحة' });
  const result = serverDb.bulkImportRegions(regions, req.user!.id);
  return res.json({ message: `تم استيراد ${result.total} منطقة بنجاح (جديد: ${result.created}، تم التحديث: ${result.updated})`, result });
});

// --- PRODUCTS (الأصناف) API ---
app.get('/api/products', authenticateToken, (req: Request, res: Response) => {
  const products = serverDb.getAllProducts();
  return res.json({ products });
});

app.post('/api/products', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { id, itemCode, name, scientificName, category, unitPrice, packageSize, assignedRepIds, isActive } = req.body;
  if (!id && (!itemCode || !name)) {
    return res.status(400).json({ error: 'يرجى إدخال كود واسم الصنف' });
  }
  const product = serverDb.upsertProduct(
    { id, itemCode, name, scientificName, category, unitPrice, packageSize, assignedRepIds, isActive },
    req.user!.id
  );
  return res.json({ message: 'تم حفظ الصنف بنجاح', product });
});

app.post('/api/products/:id/assign', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { assignedRepIds, repIds } = req.body;
  const targetIds = Array.isArray(assignedRepIds) ? assignedRepIds : (Array.isArray(repIds) ? repIds : []);
  const product = serverDb.assignProductReps(req.params.id, targetIds, req.user!.id);
  return res.json({ message: 'تم حفظ وتحديث تعيين المناديب للصنف بنجاح', product });
});

app.delete('/api/products/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const deleted = serverDb.deleteProduct(req.params.id, req.user!.id);
  return res.json({ success: deleted, message: deleted ? 'تم حذف الصنف بنجاح' : 'الصنف غير موجود' });
});

app.post('/api/products/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { products } = req.body;
  if (!Array.isArray(products)) return res.status(400).json({ error: 'قائمة الأصناف غير صالحة' });
  const result = serverDb.bulkImportProducts(products, req.user!.id);
  return res.json({ message: `تم استيراد ${result.total} صنف بنجاح (جديد: ${result.created}، تم التحديث: ${result.updated})`, result });
});

// --- CLIENTS (العملاء) API ---
app.get('/api/clients', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const region = req.query.region as string;
  const doctorClass = req.query.doctorClass as string;
  const regionSection = req.query.regionSection as string;
  let repId = req.query.repId as string;
  if (!repId && req.user?.role === 'SALES_REP') {
    repId = req.user.id;
  }
  const clients = serverDb.getAllClients(region, repId, doctorClass);
  return res.json({ clients });
});

app.post('/api/clients', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { clientCode, name, clientType, doctorClass, regionSection, specialty, phone, address, region, assignedRepId, latitude, longitude, allowedVisitRadiusMeters, isActive } = req.body;
  if (!clientCode || !name) {
    return res.status(400).json({ error: 'يرجى إدخال كود واسم العميل' });
  }
  const client = serverDb.upsertClient(
    { id: req.body.id, clientCode, name, clientType, doctorClass, regionSection, specialty, phone, address, region, assignedRepId, latitude, longitude, allowedVisitRadiusMeters, isActive },
    req.user!.id
  );
  return res.json({ message: 'تم حفظ بيانات العميل بنجاح', client });
});

app.delete('/api/clients/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const deleted = serverDb.deleteClient(req.params.id, req.user!.id);
  return res.json({ success: deleted, message: deleted ? 'تم حذف العميل بنجاح' : 'العميل غير موجود' });
});

app.post('/api/clients/:id/assign', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { repId } = req.body;
  const client = serverDb.upsertClient({ id: req.params.id, assignedRepId: repId }, req.user!.id);
  return res.json({ message: 'تم تعيين المندوب للعميل بنجاح', client });
});

app.post('/api/clients/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { clients } = req.body;
  if (!Array.isArray(clients)) return res.status(400).json({ error: 'قائمة العملاء غير صالحة' });
  const result = serverDb.bulkImportClients(clients, req.user!.id);
  return res.json({ message: `تم استيراد ${result.total} عميل بنجاح (جديد: ${result.created}، تم التحديث: ${result.updated})`, result });
});

// --- PHARMACIES (الصيدليات) API ---
app.get('/api/pharmacies', authenticateToken, (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  const region = req.query.region as string;
  let repId = req.query.repId as string;
  if (!repId && authenticatedReq.user?.role === 'SALES_REP') {
    repId = authenticatedReq.user.id;
  }
  const pharmacies = serverDb.getAllPharmacies(region, repId);
  return res.json({ pharmacies });
});

app.post('/api/pharmacies', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { pharmacyCode, name, pharmacistInCharge, licenseNumber, phone, address, region, assignedRepId, latitude, longitude, allowedVisitRadiusMeters, isActive } = req.body;
  if (!pharmacyCode || !name) {
    return res.status(400).json({ error: 'يرجى إدخال كود واسم الصيدلية' });
  }
  const pharmacy = serverDb.upsertPharmacy(
    { id: req.body.id, pharmacyCode, name, pharmacistInCharge, licenseNumber, phone, address, region, assignedRepId, latitude, longitude, allowedVisitRadiusMeters, isActive },
    req.user!.id
  );
  return res.json({ message: 'تم حفظ بيانات الصيدلية بنجاح', pharmacy });
});

app.delete('/api/pharmacies/:id', authenticateToken, requireRoles('SYSTEM_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const deleted = serverDb.deletePharmacy(req.params.id, req.user!.id);
  return res.json({ success: deleted, message: deleted ? 'تم حذف الصيدلية بنجاح' : 'الصيدلية غير موجودة' });
});

app.post('/api/pharmacies/:id/assign', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { repId } = req.body;
  const pharmacy = serverDb.upsertPharmacy({ id: req.params.id, assignedRepId: repId }, req.user!.id);
  return res.json({ message: 'تم تعيين المندوب للصيدلية بنجاح', pharmacy });
});

app.post('/api/pharmacies/bulk', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { pharmacies } = req.body;
  if (!Array.isArray(pharmacies)) return res.status(400).json({ error: 'قائمة الصيدليات غير صالحة' });
  const result = serverDb.bulkImportPharmacies(pharmacies, req.user!.id);
  return res.json({ message: `تم استيراد ${result.total} صيدلية بنجاح (جديد: ${result.created}، تم التحديث: ${result.updated})`, result });
});

// --- AUDIT LOGS ---
app.get('/api/audit-logs', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: Request, res: Response) => {
  const logs = serverDb.getAuditLogs(200);
  return res.json({ auditLogs: logs });
});

app.post('/api/audit-events', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { action, entityType, entityId, metadata } = req.body;
  const log = serverDb.addAuditLog({
    userId: req.user!.id,
    role: req.user!.role,
    action: action || 'CLIENT_AUDIT_EVENT',
    entityType: entityType || 'CLIENT',
    entityId: entityId || 'unknown',
    timestamp: new Date().toISOString(),
    metadata,
  });
  return res.json({ success: true, log });
});

// --- DAILY & EXPORT REPORTS ---
app.get('/api/reports/daily', authenticateToken, requireRoles('SYSTEM_ADMIN', 'SALES_MANAGER'), (req: Request, res: Response) => {
  const targetDate = (req.query.date as string) || new Date().toISOString().substring(0, 10);
  const visits = serverDb.getVisits({ date: targetDate });

  const withinRadius = visits.filter(v => v.locationStatus === 'WITHIN_RADIUS').length;
  const outsideRadius = visits.filter(v => v.locationStatus === 'OUTSIDE_RADIUS').length;
  const gpsUnavailable = visits.filter(v => v.locationStatus === 'GPS_UNAVAILABLE').length;
  const lowAccuracy = visits.filter(v => v.locationStatus === 'LOW_ACCURACY').length;
  const mockLocationWarnings = visits.filter(v => v.isStartMock || v.isEndMock).length;
  const pendingSync = visits.filter(v => v.state === 'PENDING_SYNC').length;
  const activeRepsCount = new Set(visits.map(v => v.userId)).size;

  return res.json({
    summary: {
      date: targetDate,
      totalVisits: visits.length,
      withinRadius,
      outsideRadius,
      gpsUnavailable,
      lowAccuracy,
      mockLocationWarnings,
      pendingSync,
      syncFailed: 0,
      activeRepsCount,
    },
    visits,
  });
});

// --- VITE FRONTEND MIDDLEWARE INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` FIELD VISIT TRACKER FULL-STACK SERVER RUNNING`);
    console.log(` Port: ${PORT}`);
    console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Offline-First & Delta Sync Ready`);
    console.log(`====================================================`);
  });
}

startServer();
