import React, { useState } from 'react';
import { Modal, Button, Alert, Badge, Row, Col } from 'react-bootstrap';
import { claimsAPI } from '../services/api';
import { FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface Claim {
  _id: string;
  calculatedEarnings: number;
  deductionAmount: number;
  deductionReason: string;
  status: string;
  postIds: any[];
  createdAt: string;
}

interface DeductionResponseModalProps {
  show: boolean;
  onHide: () => void;
  claim: Claim | null;
  onResponseSubmitted: () => void;
}

const DeductionResponseModal: React.FC<DeductionResponseModalProps> = ({ 
  show, 
  onHide, 
  claim, 
  onResponseSubmitted 
}) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<'accept' | 'reject' | null>(null);

  const handleResponse = async (accepted: boolean) => {
    if (!claim) return;

    setLoading(true);
    try {
      await claimsAPI.respondToDeduction(claim._id, accepted);
      
      const action = accepted ? 'accepted' : 'rejected';
      const message = accepted 
        ? 'Deduction accepted! Claim moved to Admin for final approval.'
        : 'Deduction rejected! Claim returned to Account for re-review.';
      
      toast.success(message);
      
      onResponseSubmitted();
      onHide();
      setResponse(null);
    } catch (error: any) {
      console.error('Error responding to deduction:', error);
      toast.error('Failed to respond to deduction: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const finalAmount = claim ? claim.calculatedEarnings - claim.deductionAmount : 0;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaExclamationTriangle className="text-warning me-2" />
          Deduction Applied to Your Claim
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {claim && (
          <div>
            <Alert variant="warning">
              <strong>Account Reviewer has applied a deduction to your claim.</strong>
              <br />
              Please review the details below and respond.
            </Alert>

            <Row className="mb-3">
              <Col md={6}>
                <h6>Original Earnings</h6>
                <Badge bg="success" className="fs-6">
                  {formatCurrency(claim.calculatedEarnings)}
                </Badge>
              </Col>
              <Col md={6}>
                <h6>Deduction Amount</h6>
                <Badge bg="danger" className="fs-6">
                  -{formatCurrency(claim.deductionAmount)}
                </Badge>
              </Col>
            </Row>

            <Row className="mb-3">
              <Col>
                <h6>Final Amount After Deduction</h6>
                <Badge bg={finalAmount > 0 ? 'primary' : 'secondary'} className="fs-5">
                  {formatCurrency(finalAmount)}
                </Badge>
              </Col>
            </Row>

            <div className="mb-3">
              <h6>Deduction Reason</h6>
              <div className="border rounded p-3 bg-light">
                {claim.deductionReason}
              </div>
            </div>

            <Alert variant="info">
              <strong>What happens next?</strong>
              <ul className="mb-0 mt-2">
                <li><strong>If you Accept:</strong> Claim moves to Admin for final approval</li>
                <li><strong>If you Reject:</strong> Claim returns to Account for re-review</li>
              </ul>
            </Alert>

            <div className="d-flex justify-content-center gap-3 mt-4">
              <Button
                variant="success"
                size="lg"
                onClick={() => handleResponse(true)}
                disabled={loading || response === 'reject'}
                className="px-4"
              >
                <FaCheck className="me-2" />
                Accept Deduction
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={() => handleResponse(false)}
                disabled={loading || response === 'accept'}
                className="px-4"
              >
                <FaTimes className="me-2" />
                Reject Deduction
              </Button>
            </div>

            {loading && (
              <div className="text-center mt-3">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Processing your response...</p>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeductionResponseModal; 