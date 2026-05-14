// Diagnóstico / eventos: misma UX que el admin de gym; en el rail solo accesible vía panel plataforma o rol superadmin.

import React from 'react';
import AdminObservabilityScreen from './AdminObservabilityScreen';

export default function SuperadminObservabilityScreen(props) {
  return <AdminObservabilityScreen {...props} observabilityBackTarget="Superadmin" />;
}
