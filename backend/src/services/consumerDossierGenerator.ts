const { generateConsumentendossier } = require('./dossierGenerator');
const {
  getConsumerDossierStatus,
  IncompleteConsumerDossierError,
} = require('./consumerDossierContext');

/**
 * Expliciete service-laag voor het consumentendossier conform art. 7:757a BW.
 * Houdt de architectuur leesbaar naast het publiekrechtelijke dossier.
 */
const generateConsumerDossier = async (projectId: string): Promise<Buffer> => {
  const status = await getConsumerDossierStatus(projectId);

  if (!status.ready) {
    throw new IncompleteConsumerDossierError(status.issues);
  }

  return generateConsumentendossier(projectId);
};

module.exports = {
  generateConsumerDossier,
  generateConsumentendossier: generateConsumerDossier,
  getConsumerDossierStatus,
  IncompleteConsumerDossierError,
};
