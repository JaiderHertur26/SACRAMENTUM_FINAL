import React from 'react';
import ReadingSummaryPanel from './ReadingSummaryPanel';

/**
 * Wrapper component for Confirmation Reading Summary Panel.
 * Reuses the logic from ReadingSummaryPanel with sacramentType='confirmation'.
 */
const ConfirmationReadingSummaryPanel = (props) => {
  return <ReadingSummaryPanel {...props} sacramentType="confirmation" />;
};

export default ConfirmationReadingSummaryPanel;