// O APK do inventário geral pode coexistir com o aplicativo de contagem cíclica.
module.exports = ({ config }) => {
  if (process.env.COLETOR_APK !== '1') return config;
  return {
    ...config,
    name: 'Inventário Geral',
    scheme: 'inventariogeral',
    android: { ...config.android, package: 'com.ruffghanor20.inventariogeral' },
    extra: { ...config.extra, inventarioGeral: true },
  };
};
