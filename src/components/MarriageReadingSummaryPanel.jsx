import React from 'react';
import ReadingSummaryPanel from './ReadingSummaryPanel';

/**
 * Wrapper component for Marriage Reading Summary Panel.
 * Reuses the logic from ReadingSummaryPanel with sacramentType='marriage'.
 */
const MarriageReadingSummaryPanel = (props) => {
  return <ReadingSummaryPanel {...props} sacramentType="marriage" />;
};

export default MarriageReadingSummaryPanel;