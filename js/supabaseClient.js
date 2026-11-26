// Supabase client configuration. Only the public anon/publishable key belongs here.
(function(){
  // إعدادات المشروع الافتراضية (Project URL + المفتاح العام Publishable فقط - آمنة للمتصفح).
  // الأمان الفعلي يأتي من سياسات RLS في قاعدة البيانات، وليس من إخفاء هذا المفتاح.
  const DEFAULT_SUPABASE_URL = 'https://zpitbgwgiofezckzibzo.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_RuniWmFCZcgSTlUSmpYz5w_0-ElQbfV';
  const readConfig = () => ({
    url: (localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL).trim(),
    key: (localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_KEY).trim()
  });
  async function testSupabaseConnection(url, key){
    const cleanUrl = String(url || '').trim().replace(/\/$/, '');
    const cleanKey = String(key || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) throw new Error('رابط المشروع غير صحيح. انسخ Project URL فقط بدون /rest/v1/');
    if (!cleanKey || cleanKey.length < 30) throw new Error('المفتاح العام غير صحيح أو غير مكتمل. استخدم Publishable أو anon فقط.');
    if (cleanKey.startsWith('sb_secret_')) throw new Error('المفتاح المدخل Secret وليس عامًا. لا تضعه في المتصفح.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { apikey: cleanKey, Accept: 'application/json' };
      const [authResponse, dataResponse] = await Promise.all([
        fetch(`${cleanUrl}/auth/v1/settings`, { method: 'GET', headers, signal: controller.signal }),
        // Test a real, harmless table endpoint instead of PostgREST's OpenAPI root.
        // The OpenAPI root may be restricted separately and can misleadingly demand a secret key.
        fetch(`${cleanUrl}/rest/v1/grades_classes?select=id&limit=0`, { method: 'GET', headers, signal: controller.signal })
      ]);
      if (!authResponse.ok) {
        let detail = '';
        try { const body = await authResponse.json(); detail = body.msg || body.message || body.error_description || body.error || ''; } catch (_) {}
        throw new Error(`خدمة Auth رفضت الاتصال (HTTP ${authResponse.status})${detail ? `: ${detail}` : ''}. راجع Project URL والمفتاح العام.`);
      }
      if (!dataResponse.ok) {
        let detail = '', code = '';
        try { const body = await dataResponse.json(); detail = body.message || body.details || body.hint || ''; code = body.code || ''; } catch (_) {}
        // This project intentionally revoked anon table grants. A permission-denied
        // response proves the Data API was reached; it is not a connection failure.
        const permissionDenied = dataResponse.status === 401 || dataResponse.status === 403 || code === '42501';
        if (!permissionDenied) {
          throw new Error(`خدمة قاعدة البيانات Data API غير متاحة (HTTP ${dataResponse.status})${detail ? `: ${detail}` : ''}. راجع تفعيل Data API ورابط المشروع.`);
        }
        if (/invalid api key|secret api key required/i.test(detail)) {
          throw new Error(`بوابة Data API رفضت المفتاح (HTTP ${dataResponse.status}): ${detail}. تأكد أنك تستخدم Publishable key الكامل الخاص بنفس المشروع، ولا تستخدم Secret key.`);
        }
        return { auth: true, dataApi: true, dataApiPermission: 'anonymous access blocked as expected' };
      }
      return { auth: true, dataApi: true };
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بعد 12 ثانية. افحص الإنترنت وحاول مرة أخرى.');
      if (error instanceof TypeError) throw new Error('تعذر الوصول إلى Supabase. افحص الإنترنت، أو جرّب فتح المشروع من Live Preview مرة أخرى.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.testSupabaseConnection = testSupabaseConnection;
  window.verifyStoredSupabaseConnection = async function(){
    const cfg = readConfig();
    if (!cfg.url || !cfg.key) throw new Error('لم يتم حفظ رابط المشروع والمفتاح العام بعد.');
    return testSupabaseConnection(cfg.url, cfg.key);
  };

  function configureSupabase(url, key){
    const cleanUrl = String(url || '').trim().replace(/\/$/, '');
    const cleanKey = String(key || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) throw new Error('رابط مشروع Supabase غير صحيح');
    if (!cleanKey || cleanKey.length < 30) throw new Error('المفتاح العام غير صحيح أو ناقص');
    if (cleanKey.startsWith('sb_secret_')) throw new Error('هذا مفتاح Secret وليس مفتاحًا عامًا. استخدم anon أو publishable فقط.');
    try { const payload=cleanKey.split('.')[1]; if(payload){const decoded=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))); if(decoded.role==='service_role') throw new Error('مفتاح service_role مرفوض داخل المتصفح. استخدم anon فقط.');} } catch(error) { if(/service_role|Secret/.test(error.message)) throw error; }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') throw new Error('تعذر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
    localStorage.setItem('SUPABASE_URL', cleanUrl);
    localStorage.setItem('SUPABASE_ANON_KEY', cleanKey);
    window.supabaseClient = window.supabase.createClient(cleanUrl, cleanKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.isDemoMode = false;
    return window.supabaseClient;
  }
  const cfg = readConfig();
  window.supabaseClient = null;
  window.isDemoMode = true;
  window.configureSupabase = configureSupabase;
  if (cfg.url && cfg.key && window.supabase) {
    try { configureSupabase(cfg.url, cfg.key); }
    catch (error) { console.error('Supabase config error:', error); }
  }
})();
