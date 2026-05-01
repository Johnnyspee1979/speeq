const { getSupabaseAdminClient } = require('./supabaseAdmin');

type AuthenticatedUserContext = {
  userId: string;
  email: string;
  role: string;
  companyName: string;
};

type ProjectAccessResult = {
  isOwner: boolean;
  isQualityAssurer: boolean;
};

const createHttpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

const parseBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) {
    return '';
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== 'bearer') {
    return '';
  }

  return token?.trim() ?? '';
};

const isReviewerRole = (role?: string | null) =>
  ['AANNEMER', 'KWALITEITSBORGER'].includes(String(role ?? '').trim().toUpperCase());

const getAuthenticatedUserContext = async (
  authorizationHeader?: string | null
): Promise<AuthenticatedUserContext> => {
  const accessToken = parseBearerToken(authorizationHeader);

  if (!accessToken) {
    throw createHttpError(401, 'Authorization Bearer token ontbreekt.');
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw createHttpError(401, 'Ongeldige of verlopen sessie.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, company_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw createHttpError(
      500,
      `Gebruikersprofiel kon niet worden opgehaald: ${profileError.message}`
    );
  }

  return {
    userId: user.id,
    email: String(user.email ?? profile?.email ?? '').trim(),
    role: String(profile?.role ?? 'ONDERAANNEMER').trim().toUpperCase(),
    companyName: String(profile?.company_name ?? '').trim(),
  };
};

const assertProjectReviewAccess = async (
  projectId: string,
  context: AuthenticatedUserContext
): Promise<ProjectAccessResult> => {
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    throw createHttpError(400, 'projectId ontbreekt voor reviewcontrole.');
  }

  if (!isReviewerRole(context.role)) {
    throw createHttpError(
      403,
      'Gebruiker heeft geen rechten om bewijsstatussen te beoordelen.'
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: project, error } = await supabase
    .from('projects')
    .select('owner_id, kwaliteitsborger_id')
    .eq('id', normalizedProjectId)
    .maybeSingle();

  if (error) {
    throw createHttpError(
      500,
      `Projectrechten konden niet worden gecontroleerd: ${error.message}`
    );
  }

  const isOwner = project?.owner_id === context.userId;
  const isQualityAssurer = project?.kwaliteitsborger_id === context.userId;
  const hasAccess =
    context.role === 'KWALITEITSBORGER' ? isQualityAssurer || isOwner : isOwner;

  if (!hasAccess) {
    throw createHttpError(403, 'Gebruiker heeft geen rechten op dit project.');
  }

  return { isOwner, isQualityAssurer };
};

module.exports = {
  assertProjectReviewAccess,
  createHttpError,
  getAuthenticatedUserContext,
  isReviewerRole,
  parseBearerToken,
};
