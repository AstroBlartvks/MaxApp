import { Button, Container, Typography } from '@maxhub/max-ui';
import { useState, useEffect, useRef } from 'react';
import './WelcomeScreen.css';

function WelcomeScreen({ photos, onStart }) {

  const [webAppReady, setWebAppReady] = useState(false);

  useEffect(() => {
    if (window.WebApp) {
      setWebAppReady(true);
      window.WebApp.ready();
    } else {
      const checkWebApp = setInterval(() => {
        if (window.WebApp) {
          setWebAppReady(true);
          window.WebApp.ready();
          clearInterval(checkWebApp);
        }
      }, 100);

      return () => clearInterval(checkWebApp);
    }
  }, []);

  return (
    <div className="welcome-screen">

      <script src="https://st.max.ru/js/max-web-app.js"/>

      <div className="photo-grid-background">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-cell blurred">
            <img src={photo.url} alt="" />
          </div>
        ))}
      </div>
      
      <div className="welcome-content">
        <Container className="welcome-container">
          <div className="welcome-text">
            <Typography.Title level={1} className="welcome-title">
              Добро пожаловать
            </Typography.Title>
            <Typography.Body className="welcome-subtitle">
              Ваша фотогалерея в Max
            </Typography.Body>
          </div>

          {/* {webAppReady ? (
            <div className="webapp-info">
              <Typography.Body>
                Платформа: {window.WebApp.platform}
              </Typography.Body>
              <Typography.Body>
                Версия MAX: {window.WebApp.version}
              </Typography.Body>
              <Typography.Body>
                Init Data: {JSON.stringify(window.WebApp.initData)}
              </Typography.Body>
            </div>
          ) : (
            <Typography.Body>Загрузка WebApp...</Typography.Body>
          )} */}
          
          <Button 
            size="l" 
            mode="primary" 
            stretched
            onClick={onStart}
            className="start-button"
          >
            ▶ Начать
          </Button>
        </Container>
      </div>
    </div>
  );
}

export default WelcomeScreen;
