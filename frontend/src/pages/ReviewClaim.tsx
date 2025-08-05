import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Modal, Form, Alert, Image, Pagination } from 'react-bootstrap';
import { claimsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { FaEye, FaCheck, FaTimes, FaMinus, FaLock, FaImage, FaExpand } from 'react-icons/fa';
import toast from 'react-hot-toast';

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
}

const ReviewClaim: React.FC = () => {
  const { user } = useAuth();
  const { onAutoRefresh, offAutoRefresh, lockClaim, unlockClaim, joinClaim, leaveClaim } = useSocket();
  
  const [claims, setClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionReason, setDeductionReason] = useState('');
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [claimLocked, setClaimLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClaims, setTotalClaims] = useState(0);
  const [claimsPerPage] = useState(5);

  // Filters
  const [filters, setFilters] = useState({
    searchTerm: '',
    status: 'all',
    startDate: '',
    endDate: '',
    minEarnings: '',
    maxEarnings: ''
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
  
  // Reload data when other filters change
  useEffect(() => {
    if (currentPage === 1) {
      loadClaims();
    } else {
      setCurrentPage(1);
    }
  }, [filters.status, filters.startDate, filters.endDate, filters.minEarnings, filters.maxEarnings]);

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
        apiParams.status = 'pending,deducted,user_accepted';
      }
      
      // Add date filters
      if (filters.startDate) apiParams.startDate = filters.startDate;
      if (filters.endDate) apiParams.endDate = filters.endDate;
      
      // Add earnings filters
      if (filters.minEarnings) apiParams.minEarnings = filters.minEarnings;
      if (filters.maxEarnings) apiParams.maxEarnings = filters.maxEarnings;
      
      const response = await claimsAPI.getAllClaims(apiParams);
      
      setAllClaims(response.data.claims);
      
      // Set pagination info
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.total);
        setTotalClaims(response.data.pagination.total * claimsPerPage);
      } else {
        setTotalPages(1);
        setTotalClaims(0);
      }
    } catch (error: any) {
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

  const handleClaimAction = async (action: 'approve' | 'reject' | 'deduct' | 'final-approve') => {
    if (!selectedClaim) return;

    try {
      setProcessing(true);
      
      if (action === 'approve') {
        await claimsAPI.accountApprove(selectedClaim._id);
        toast.success('Claim approved successfully!');
      } else if (action === 'reject') {
        await claimsAPI.accountReject(selectedClaim._id, rejectReason);
        toast.success('Claim rejected successfully!');
        setShowRejectModal(false);
        setRejectReason('');
      } else if (action === 'deduct') {
        await claimsAPI.applyDeduction(selectedClaim._id, {
          deductionAmount: parseFloat(deductionAmount),
          deductionReason: deductionReason
        });
        toast.success('Deduction applied successfully!');
        setShowDeductionModal(false);
        setDeductionAmount('');
        setDeductionReason('');
      } else if (action === 'final-approve') {
        await claimsAPI.adminApprove(selectedClaim._id);
        toast.success('Claim finally approved!');
      }
      
      // Reload claims to get updated data
      await loadClaims();
      
      // Close modal only if it was opened from table (not from view modal)
      if (!showModal) {
        handleCloseModal();
      }
    } catch (error: any) {
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  // Handler for approve action from modal
  const handleModalApprove = async () => {
    if (!selectedClaim) return;
    
    try {
      setProcessing(true);
      await claimsAPI.accountApprove(selectedClaim._id);
      toast.success('Claim approved successfully!');
      await loadClaims();
      handleCloseModal();
    } catch (error: any) {
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  // Handler for final approve action from modal
  const handleModalFinalApprove = async () => {
    if (!selectedClaim) return;
    
    try {
      setProcessing(true);
      await claimsAPI.adminApprove(selectedClaim._id);
      toast.success('Claim finally approved!');
      await loadClaims();
      handleCloseModal();
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
      toast.success('Claim rejected successfully!');
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

  const handleApplyDeduction = async () => {
    if (!deductionAmount || !deductionReason.trim()) {
      toast.error('Please provide both deduction amount and reason');
      return;
    }
    if (!selectedClaim) return;
    
    if (parseFloat(deductionAmount) >= selectedClaim.calculatedEarnings) {
      toast.error('Deduction amount cannot be greater than or equal to earnings');
      return;
    }
    
    try {
      setProcessing(true);
      await claimsAPI.applyDeduction(selectedClaim._id, {
        deductionAmount: parseFloat(deductionAmount),
        deductionReason: deductionReason
      });
      toast.success('Deduction applied successfully!');
      setShowDeductionModal(false);
      setDeductionAmount('');
      setDeductionReason('');
      await loadClaims();
      handleCloseModal();
    } catch (error: any) {
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const getImageUrl = (fileUrl: string) => {
    // Remove /api from the base URL since fileUrl already contains the full path
    const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/api', '');
    return `${baseUrl}${fileUrl}`;
  };

  const getFileName = (fileUrl: string) => {
    // Extract filename from URL path
    const pathParts = fileUrl.split('/');
    const filename = pathParts[pathParts.length - 1];
    // Remove any query parameters and decode URL
    const cleanFilename = decodeURIComponent(filename.split('?')[0]);
    // Make filename more readable by removing timestamp prefixes
    const readableName = cleanFilename.replace(/^PROOFFILES-\d+-\d+\./, 'Proof Image ');
    return readableName || 'proof-image';
  };

  const getStatusColor = (status: string) => {
    const statusConfig = {
      pending: 'warning',
      deducted: 'info',
      user_accepted: 'success',
      user_rejected: 'danger',
      account_approved: 'primary',
      admin_approved: 'success',
      settled: 'secondary'
    };
    return statusConfig[status as keyof typeof statusConfig] || 'secondary';
  };

  const getStatusText = (status: string) => {
    const statusConfig = {
      pending: 'Pending',
      deducted: 'Deducted',
      user_accepted: 'Accepted',
      user_rejected: 'Rejected',
      account_approved: 'Approved',
      admin_approved: 'Final Approved',
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
      status: 'all',
      startDate: '',
      endDate: '',
      minEarnings: '',
      maxEarnings: ''
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
          <p className="mt-2">Loading claims for review...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-warning text-dark">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">
                    <FaEye className="me-2" />
                    Review Claims - Account Dashboard
                  </h4>
                  <small>Review and process claims submitted by users</small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Form.Select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: 'auto' }}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="deducted">Deducted</option>
                    <option value="user_accepted">Accepted</option>
                    <option value="user_rejected">Rejected</option>
                  </Form.Select>
                  <Form.Control
                    type="text"
                    placeholder="Search claims..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                    style={{ width: 'auto' }}
                  />
                  <Button variant="outline-primary" onClick={clearFilters} disabled={!filters.searchTerm && filters.status === 'all'}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="mb-3">
                <Col>
                  <Button
                    variant="outline-primary"
                    onClick={loadClaims}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Loading...
                      </>
                    ) : (
                      'Refresh Claims'
                    )}
                  </Button>
                </Col>
              </Row>

              {claims.length === 0 ? (
                <Alert variant="info">
                  <h5>No Pending Claims</h5>
                  <p className="mb-0">There are no claims waiting for your review.</p>
                </Alert>
              ) : (
                <>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Proof Images</th>
                        <th>Original Earnings</th>
                        <th>Deduction</th>
                        <th>Final Amount</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim) => (
                        <tr key={claim._id}>
                          <td>
                            <div>
                              <strong>{claim.userId.name}</strong>
                              <br />
                              <small className="text-muted">{claim.userId.email}</small>
                            </div>
                          </td>
                          <td>
                            {claim.proofFileUrls && claim.proofFileUrls.length > 0 ? (
                              <div className="d-flex flex-column gap-2">
                                {claim.proofFileUrls.slice(0, 3).map((fileUrl, index) => (
                                  <div key={index} className="d-flex align-items-center gap-2 p-2 border rounded bg-light">
                                    <div className="position-relative">
                                      <Image
                                        src={getImageUrl(fileUrl)}
                                        alt={`Proof ${index + 1}`}
                                        className="img-thumbnail"
                                        style={{ 
                                          width: '50px',
                                          height: '50px',
                                          objectFit: 'cover',
                                          cursor: 'pointer',
                                          border: '2px solid #dee2e6',
                                          transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => window.open(getImageUrl(fileUrl), '_blank')}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.borderColor = '#007bff';
                                          e.currentTarget.style.transform = 'scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.borderColor = '#dee2e6';
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                        onError={(e) => {
                                          console.error('Image failed to load:', getImageUrl(fileUrl));
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                    <div className="flex-grow-1">
                                      <Button
                                        variant="link"
                                        className="p-0 text-decoration-none text-start"
                                        style={{ fontSize: '0.875rem', color: '#007bff' }}
                                        onClick={() => window.open(getImageUrl(fileUrl), '_blank')}
                                        title="Click to view full image"
                                      >
                                        <FaImage className="me-1" />
                                        {getFileName(fileUrl)}
                                      </Button>
                                    </div>
                                    <div className="d-flex gap-1">
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        className="p-1"
                                        style={{ width: '28px', height: '28px' }}
                                        onClick={() => window.open(getImageUrl(fileUrl), '_blank')}
                                        title="Open in new tab"
                                      >
                                        <FaExpand size={10} />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {claim.proofFileUrls.length > 3 && (
                                  <div className="text-center p-2 border rounded bg-light">
                                    <small className="text-muted">
                                      +{claim.proofFileUrls.length - 3} more images
                                    </small>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-muted small p-2 border rounded bg-light">
                                <FaImage className="me-1" />
                                No proof images
                              </div>
                            )}
                          </td>
                          <td>
                            <strong className="text-success">
                              {formatCurrency(claim.calculatedEarnings)}
                            </strong>
                          </td>
                          <td>
                            {claim.deductionAmount > 0 ? (
                              <span className="text-danger">
                                -{formatCurrency(claim.deductionAmount)}
                              </span>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                          <td>
                            <strong className="text-primary">
                              {formatCurrency(claim.calculatedEarnings - claim.deductionAmount)}
                            </strong>
                          </td>
                          <td><Badge bg={getStatusColor(claim.status)}>{getStatusText(claim.status)}</Badge></td>
                          <td>{formatDate(claim.createdAt)}</td>
                          <td>
                            <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleViewClaim(claim)}
                                  disabled={lockLoading || isClaimLockedByOther(claim)}
                                >
                                  {isClaimLockedByOther(claim) ? (
                                    <FaLock className="me-1" />
                                  ) : (
                                    <FaEye className="me-1" />
                                  )}
                                  {isClaimLockedByOther(claim) ? 'Locked' : 'View'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                      ))}
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
          <Modal.Title>Claim Details</Modal.Title>
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

              {selectedClaim.status === 'pending' && (
                <Alert variant="info" className="mt-3">
                  <strong>Action Required:</strong> This claim is pending review.
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="success"
                      onClick={handleModalApprove}
                      disabled={processing}
                    >
                      <FaCheck className="me-2" />
                      Approve
                    </Button>
                    <Button
                      variant="warning"
                      onClick={() => setShowDeductionModal(true)}
                      disabled={processing}
                    >
                      <FaMinus className="me-2" />
                      Apply Deduction
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

              {selectedClaim.status === 'deducted' && (
                <Alert variant="warning" className="mt-3">
                  <strong>User Response Required:</strong> User needs to accept or reject the deduction.
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="info"
                      onClick={handleCloseModal}
                      disabled={processing}
                    >
                      <FaEye className="me-2" />
                      View Only
                    </Button>
                  </div>
                </Alert>
              )}

              {selectedClaim.status === 'user_accepted' && (
                <Alert variant="info" className="mt-3">
                  <strong>Ready for Final Approval:</strong> User has accepted the deduction.
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="success"
                      onClick={handleModalFinalApprove}
                      disabled={processing}
                    >
                      <FaCheck className="me-2" />
                      Final Approve
                    </Button>
                  </div>
                </Alert>
              )}

              {selectedClaim.status === 'user_rejected' && (
                <Alert variant="danger" className="mt-3">
                  <strong>Claim Rejected:</strong> The user has rejected the claim.
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="success"
                      onClick={handleModalApprove}
                      disabled={processing}
                    >
                      <FaCheck className="me-2" />
                      Re-approve
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

      <Modal show={showDeductionModal} onHide={() => setShowDeductionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Apply Deduction</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Deduction Amount (₹)</Form.Label>
              <Form.Control
                type="number"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value)}
                placeholder="Enter deduction amount"
                min="0"
                step="0.01"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Deduction Reason</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={deductionReason}
                onChange={(e) => setDeductionReason(e.target.value)}
                placeholder="Explain the reason for deduction"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeductionModal(false)}>
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={handleApplyDeduction}
            disabled={processing || !deductionAmount || !deductionReason}
          >
            {processing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Applying...
              </>
            ) : (
              <>
                <FaMinus className="me-1" />
                Apply Deduction
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Reject Claim</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Rejection Reason</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain the reason for rejecting this claim"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            disabled={processing || !rejectReason}
          >
            {processing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Rejecting...
              </>
            ) : (
              <>
                <FaTimes className="me-1" />
                Reject Claim
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ReviewClaim; 