import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Button, Table, Form, Modal, Alert, Pagination } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { FaEye, FaCheck } from 'react-icons/fa';
import { claimsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Image } from 'react-bootstrap';
import { FaFilter, FaImage, FaDownload } from 'react-icons/fa';
import { FaTimes } from 'react-icons/fa';

interface Claim {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  calculatedEarnings: number;
  status: string;
  createdAt: string;
  deductionAmount: number;
  deductionReason: string;
  proofFileUrls: string[];
  postIds: string[];
  lockedBy?: string;
  lockTimestamp?: string;
  reviewedBy?: {
    _id: string;
    name: string;
  };
  finalApprovedBy?: {
    _id: string;
    name: string;
  };
}

const FinalApproval: React.FC = () => {
  const { user } = useAuth();
  const { onAutoRefresh, offAutoRefresh, lockClaim, unlockClaim, joinClaim, leaveClaim } = useSocket();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClaims, setTotalClaims] = useState(0);
  const [claimsPerPage] = useState(5);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [claimLocked, setClaimLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    searchTerm: '',
    status: 'all'
  });

  // Load data when component mounts or page changes
  useEffect(() => {
    loadClaims();
  }, [currentPage]);

  // Register auto-refresh callback
  useEffect(() => {
    const handleAutoRefresh = () => {

      loadClaims();
    };

    onAutoRefresh(handleAutoRefresh);

    return () => {
      offAutoRefresh(handleAutoRefresh);
    };
  }, [onAutoRefresh, offAutoRefresh]);

  // Apply search filter without reloading data
  useEffect(() => {
    applySearchFilter();
  }, [filters.searchTerm, allClaims]);
  
  // Reload data when status filter changes
  useEffect(() => {
    if (currentPage === 1) {
      loadClaims();
    } else {
      setCurrentPage(1);
    }
  }, [filters.status]);

  const loadClaims = async () => {
    try {
      setLoading(true);
      
      // Build API parameters including filters
      const apiParams: any = {
        page: currentPage,
        limit: claimsPerPage
      };
      
      // Add status filter
      if (filters.status !== 'all') {
        apiParams.status = filters.status;
      } else {
        apiParams.status = 'user_accepted,account_approved';
      }
      
      const response = await claimsAPI.getAllClaims(apiParams);
      setAllClaims(response.data.claims);
      
      // Set pagination info
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.total);
        setTotalClaims(response.data.pagination.total * claimsPerPage);
      }

    } catch (error: any) {
      console.error('Error loading claims:', error);
      toast.error('Failed to load claims: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const applySearchFilter = useCallback(() => {
    let filteredClaims = [...allClaims];

    // Apply search filter only
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredClaims = filteredClaims.filter(claim =>
        claim.userId.name.toLowerCase().includes(searchLower) ||
        claim.userId.email.toLowerCase().includes(searchLower)
      );
    }

    setClaims(filteredClaims);
  }, [filters.searchTerm, allClaims]);

  const handleViewClaim = async (claim: Claim) => {
    try {
      setLockLoading(true);
      
      // Try to lock the claim
      const locked = await lockClaim(claim._id);
      
      if (locked) {
        setClaimLocked(true);
        setSelectedClaim(claim);
        setShowModal(true);
        joinClaim(claim._id);
        toast.success('Claim locked for editing');
      } else {
        toast.error('This claim is currently being reviewed by another user');
      }
    } catch (error) {
      console.error('Error locking claim:', error);
      toast.error('Failed to lock claim');
    } finally {
      setLockLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (selectedClaim && claimLocked) {
      unlockClaim(selectedClaim._id);
      leaveClaim(selectedClaim._id);
      setClaimLocked(false);
      toast.success('Claim unlocked');
    }
    setShowModal(false);
    setSelectedClaim(null);
  };

  const handleClaimAction = async (action: 'accept' | 'reject' | 'final-approve') => {
    if (!selectedClaim) return;

    try {
      setProcessing(true);
      
      if (action === 'final-approve') {
        await claimsAPI.adminApprove(selectedClaim._id);
        toast.success('Claim finally approved!');
        await loadClaims();
        handleCloseModal();
      } else if (action === 'reject') {
        await claimsAPI.accountReject(selectedClaim._id, rejectReason);
        toast.success('Claim rejected!');
        setShowRejectModal(false);
        setRejectReason('');
        await loadClaims();
        handleCloseModal();
      }
    } catch (error: any) {
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    if (!selectedClaim) return;
    
    try {
      setProcessing(true);
      await claimsAPI.accountReject(selectedClaim._id, rejectReason);
      toast.success('Claim rejected!');
      setShowRejectModal(false);
      setRejectReason('');
      await loadClaims();
      handleCloseModal();
    } catch (error: any) {
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const getImageUrl = (fileUrl: string) => {
    return `${process.env.REACT_APP_API_URL?.replace('/api', '')}${fileUrl}`;
  };

  const getStatusColor = (status: string) => {
    const statusConfig = {
      pending: 'warning',
      deducted: 'danger',
      user_accepted: 'info',
      user_rejected: 'secondary',
      account_approved: 'primary',
      admin_approved: 'success',
      settled: 'success'
    };
    return statusConfig[status as keyof typeof statusConfig] || 'secondary';
  };

  const getStatusText = (status: string) => {
    const statusConfig = {
      pending: 'Pending',
      deducted: 'Deducted',
      user_accepted: 'Accepted',
      user_rejected: 'Rejected',
      account_approved: 'Account Approved',
      admin_approved: 'Admin Approved',
      settled: 'Settled'
    };
    return statusConfig[status as keyof typeof statusConfig] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'all'
    });
    setCurrentPage(1);
  };

  // Helper function to check if claim is locked by someone else
  const isClaimLockedByOther = (claim: Claim): boolean => {
    return !!(claim.lockedBy && claim.lockedBy !== user?.id);
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading claims for final approval...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-success text-white">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">
                    <FaCheck className="me-2" />
                    Final Approval - Admin Dashboard
                  </h4>
                  <small>Review claims that have been approved by account reviewers</small>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="text-light small">
                    <i className="fas fa-sync-alt me-1"></i>
                    Auto-refresh enabled
                  </div>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="mb-4">
                <Col xs={12}>
                  <Card className="bg-light">
                    <Card.Body>
                      <h6 className="mb-3">
                        <FaFilter className="me-2" />
                        Filters
                      </h6>
                      <Row>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label>Search Creator</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Search by name or email..."
                              value={filters.searchTerm}
                              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label>Status</Form.Label>
                            <Form.Select
                              value={filters.status}
                              onChange={(e) => setFilters({...filters, status: e.target.value})}
                            >
                              <option value="all">All Status</option>
                              <option value="account_approved">Account Approved</option>
                              <option value="user_accepted">User Accepted</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={4} className="d-flex align-items-end">
                          <Button variant="outline-secondary" onClick={clearFilters}>
                            Clear Filters
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {claims.length === 0 ? (
                <Alert variant="info">
                  <h5>No Claims for Final Approval</h5>
                  <p className="mb-0">
                    {allClaims.length === 0 
                      ? "There are no claims that have been approved by account reviewers and are waiting for final admin approval."
                      : "No claims match the current filters."
                    }
                  </p>
                </Alert>
              ) : (
                <>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>Creator Name</th>
                        <th>Email</th>
                        <th>Original Earnings</th>
                        <th>Deduction</th>
                        <th>Final Amount</th>
                        <th>Status</th>
                        <th>Submitted Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim) => {
                        const finalAmount = claim.calculatedEarnings - claim.deductionAmount;
                        return (
                          <tr key={claim._id}>
                            <td>{claim.userId.name}</td>
                            <td>{claim.userId.email}</td>
                            <td>{formatCurrency(claim.calculatedEarnings)}</td>
                            <td className="text-danger">-{formatCurrency(claim.deductionAmount)}</td>
                            <td className="text-success fw-bold">{formatCurrency(finalAmount)}</td>
                            <td><Badge bg={getStatusColor(claim.status)}>{getStatusText(claim.status)}</Badge></td>
                            <td>{formatDate(claim.createdAt)}</td>
                            <td>
                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleViewClaim(claim)}
                                  title="View Claim Details"
                                  disabled={isClaimLockedByOther(claim)}
                                >
                                  <FaEye />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-center mt-3">
                      <Pagination>
                        <Pagination.First 
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        />
                        <Pagination.Prev 
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        />
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, currentPage - 2) + i;
                          if (pageNum > totalPages) return null;
                          return (
                            <Pagination.Item
                              key={pageNum}
                              active={pageNum === currentPage}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Pagination.Item>
                          );
                        })}
                        
                        <Pagination.Next 
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= totalPages}
                        />
                        <Pagination.Last 
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage >= totalPages}
                        />
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Claim Details - Final Review</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedClaim && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <h6>Original Earnings</h6>
                  <Badge bg="success" className="fs-6">
                    {formatCurrency(selectedClaim.calculatedEarnings)}
                  </Badge>
                </Col>
                <Col md={6}>
                  <h6>Status</h6>
                  <Badge bg={getStatusColor(selectedClaim.status)} className="fs-6">
                    {getStatusText(selectedClaim.status)}
                  </Badge>
                </Col>
              </Row>

              {selectedClaim.deductionAmount > 0 && (
                <>
                  <Row className="mb-3">
                    <Col md={6}>
                      <h6>Deduction Amount</h6>
                      <Badge bg="danger" className="fs-6">
                        -{formatCurrency(selectedClaim.deductionAmount)}
                      </Badge>
                    </Col>
                    <Col md={6}>
                      <h6>Final Amount After Deduction</h6>
                      <Badge bg="primary" className="fs-6">
                        {formatCurrency(selectedClaim.calculatedEarnings - selectedClaim.deductionAmount)}
                      </Badge>
                    </Col>
                  </Row>

                  <div className="mb-3">
                    <h6>Deduction Reason</h6>
                    <div className="border rounded p-3 bg-light">
                      {selectedClaim.deductionReason}
                    </div>
                  </div>
                </>
              )}

              <div className="mb-3">
                <h6>Created</h6>
                <p>{formatDate(selectedClaim.createdAt)}</p>
              </div>

              {selectedClaim.proofFileUrls && selectedClaim.proofFileUrls.length > 0 && (
                <div className="mb-4">
                  <h6>
                    <FaImage className="me-2" />
                    Proof Screenshots ({selectedClaim.proofFileUrls.length})
                  </h6>
                  <p className="text-muted small mb-3">
                    These screenshots show the likes and views that were verified by the account reviewer.
                  </p>
                  <Row>
                    {selectedClaim.proofFileUrls.map((fileUrl, index) => (
                      <Col key={index} md={4} className="mb-3">
                        <div className="position-relative">
                          <Image
                            src={getImageUrl(fileUrl)}
                            alt={`Proof ${index + 1}`}
                            className="img-fluid rounded border"
                            style={{ 
                              cursor: 'pointer',
                              maxHeight: '200px',
                              width: '100%',
                              objectFit: 'cover'
                            }}
                            onClick={() => handleImageClick(getImageUrl(fileUrl))}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="position-absolute top-0 end-0 m-2">
                            <Button
                              variant="light"
                              size="sm"
                              onClick={() => window.open(getImageUrl(fileUrl), '_blank')}
                              title="Download"
                            >
                              <FaDownload />
                            </Button>
                          </div>
                          <div className="text-center mt-1">
                            <small className="text-muted">Proof {index + 1}</small>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {(selectedClaim.status === 'user_accepted' || selectedClaim.status === 'account_approved') && (
                <Alert variant="info" className="mt-3">
                  <strong>Final Approval Required:</strong> 
                  {selectedClaim.status === 'user_accepted' 
                    ? 'User has accepted the deduction. Please give final approval.'
                    : 'Claim has been approved by account reviewer. Please give final approval.'
                  }
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="success"
                      onClick={() => handleClaimAction('final-approve')}
                      disabled={processing}
                    >
                      <FaCheck className="me-2" />
                      Final Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                    >
                      <FaTimes className="me-2" />
                      Reject
                    </Button>
                  </div>
                </Alert>
              )}

              {processing && (
                <div className="text-center mt-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Processing...</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Proof Screenshot</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {selectedImage && (
            <Image
              src={selectedImage}
              alt="Proof Screenshot"
              className="img-fluid"
              style={{ maxHeight: '70vh' }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImageModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={() => selectedImage && window.open(selectedImage, '_blank')}
          >
            <FaDownload className="me-2" />
            Download
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} size="sm">
        <Modal.Header closeButton>
          <Modal.Title>Reject Claim</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Rejection Reason</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejecting the claim"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReject} disabled={processing}>
            <FaTimes className="me-2" />
            Reject Claim
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default FinalApproval; 