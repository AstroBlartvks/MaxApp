import React from 'react';
import { MaxUI, Typography } from '@maxhub/max-ui';
import './LoaderScreen.css';

function LoaderScreen() {
  return (
    <MaxUI>
      <div className="loader-screen">
        <div className="loader-spinner"></div>
        <Typography.Title level={3} className="loader-text">
          Загрузка...
        </Typography.Title>
      </div>
    </MaxUI>
  );
}

export default LoaderScreen;
