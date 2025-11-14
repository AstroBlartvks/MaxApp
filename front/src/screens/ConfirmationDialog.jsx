import { Button, Typography } from '@maxhub/max-ui';
import apiClient from '../api/apiClient';
import './ConfirmationDialog.css';

function ConfirmationDialog({ trade, onConfirm, onReject }) {
  const handleConfirm = async () => {
    try {
      await apiClient.confirmTrade(trade.id);
      onConfirm();
    } catch (error) {
      console.error("Failed to confirm trade:", error);
      alert("Ошибка подтверждения обмена. Пожалуйста, попробуйте еще раз.");
    }
  };

  const handleReject = async () => {
    try {
      await apiClient.rejectTrade(trade.id);
      onReject();
    } catch (error) {
      console.error("Failed to reject trade:", error);
      alert("Ошибка отклонения обмена. Пожалуйста, попробуйте еще раз.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <Typography.Title level={3}>Подтверждение обмена</Typography.Title>
        <Typography.Body>
          Вы действительно хотите передать фото пользователю с ID {trade.receiver_id}?
        </Typography.Body>
        <div className="modal-actions">
          <Button mode="primary" onClick={handleConfirm}>Подтвердить</Button>
          <Button mode="secondary" onClick={handleReject}>Отклонить</Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
