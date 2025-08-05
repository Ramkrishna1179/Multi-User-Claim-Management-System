import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Button, Table, Form, Alert, Pagination } from 'react-bootstrap';
import { useSocket } from '../context/SocketContext';
import { FaDownload, FaFilter } from 'react-icons/fa';
import { claimsAPI, settingsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface Claim {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  calculatedEarnings: number;
  deductionAmount: number;
  status: string;
  createdAt: string;
  reviewedBy?: {
    name: string;
  };
  finalApprovedBy?: {
    name: string;
  };
  deductionReason?: string;
}

interface ReportStats {
  totalUsers: number;
  totalPosts: number;
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  totalEarnings: number;
  totalDeductions: number;
  approvedEarnings: number;
  approvedDeductions: number;
  averageProcessingTime: number;
  topCreators: Array<{
    name: string;
    totalClaims: number;
    totalEarnings: number;
    totalDeductions: number;
    netEarnings: number;
  }>;
}



const Reports: React.FC = () => {
  const { onAutoRefresh, offAutoRefresh } = useSocket();
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [claimsPerPage] = useState(5);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    userId: '',
    minEarnings: '',
    maxEarnings: '',
    searchTerm: ''
  });

  useEffect(() => {
    loadReports();
  }, [currentPage, user]);

  useEffect(() => {
    const handleAutoRefresh = () => {
      loadReports();
    };

    onAutoRefresh(handleAutoRefresh);

    return () => {
      offAutoRefresh(handleAutoRefresh);
    };
  }, [onAutoRefresh, offAutoRefresh]);

  useEffect(() => {
    applySearchFilter();
  }, [filters.searchTerm, allClaims]);
  
  useEffect(() => {
    if (currentPage === 1) {
      loadReports();
    } else {
      setCurrentPage(1);
    }
  }, [filters.status, filters.startDate, filters.endDate, filters.minEarnings, filters.maxEarnings]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const apiParams: any = {
        page: currentPage,
        limit: claimsPerPage
      };
      
      if (filters.status !== 'all') {
        apiParams.status = filters.status;
      }
      
      if (filters.startDate) apiParams.startDate = filters.startDate;
      if (filters.endDate) apiParams.endDate = filters.endDate;
      
      if (filters.minEarnings) apiParams.minEarnings = filters.minEarnings;
      if (filters.maxEarnings) apiParams.maxEarnings = filters.maxEarnings;
      
      const claimsResponse = await claimsAPI.getAllClaims(apiParams);
      setAllClaims(claimsResponse.data.claims);
      
      // Set pagination info
      if (claimsResponse.data.pagination) {
        setTotalPages(claimsResponse.data.pagination.total);
      }
      
      // Load all claims for accurate statistics (without pagination)
      const allClaimsParams = { ...apiParams, limit: 1000, page: 1 };
      const allClaimsResponse = await claimsAPI.getAllClaims(allClaimsParams);
      const allClaims = allClaimsResponse.data.claims;



      // Load stats based on user role
      try {
        if (user?.role === 'admin') {
          // Admin users get full stats
          const statsResponse = await settingsAPI.getAdminStats();
          if (statsResponse.data.success) {
            setStats(statsResponse.data.stats);
          }
        } else {
          // Non-admin users get basic claim stats
          const statsResponse = await claimsAPI.getClaimStats();
          if (statsResponse.data.success) {
            // Convert claim stats to match our interface
            const claimStats = statsResponse.data.stats;
            
            // Calculate earnings and deductions from the claims data
            const totalEarnings = allClaims.reduce((sum: number, claim: any) => sum + claim.calculatedEarnings, 0);
            const totalDeductions = allClaims.reduce((sum: number, claim: any) => sum + claim.deductionAmount, 0);
            
            setStats({
              totalUsers: 0,
              totalPosts: 0,
              totalClaims: claimStats.total || 0,
              pendingClaims: claimStats.pending || 0,
              approvedClaims: claimStats.approved || 0,
              rejectedClaims: claimStats.deducted || 0, // Using deducted as rejected for now
              totalEarnings: totalEarnings,
              totalDeductions: totalDeductions,
              approvedEarnings: 0,
              approvedDeductions: 0,
              averageProcessingTime: 0,
              topCreators: []
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load stats:', error);
      }
      

      
    } catch (error: any) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports: ' + (error.response?.data?.message || error.message));
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'warning', text: 'Pending' },
      deducted: { variant: 'danger', text: 'Deducted' },
      user_accepted: { variant: 'info', text: 'User Accepted' },
      user_rejected: { variant: 'secondary', text: 'User Rejected' },
      account_approved: { variant: 'primary', text: 'Account Approved' },
      admin_approved: { variant: 'success', text: 'Admin Approved' },
      settled: { variant: 'success', text: 'Settled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'secondary', text: status };
    return <Badge bg={config.variant}>{config.text}</Badge>;
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
      day: 'numeric'
    });
  };

  const exportToCSV = async (type: 'claims' | 'summary') => {
    try {
      setExporting(true);
      
      if (type === 'claims') {
        // Export claims data
        const csvData = [
          // CSV Headers
          ['Claim ID', 'Creator', 'Email', 'Earnings', 'Deduction', 'Final Amount', 'Status', 'Submitted Date', 'Reviewed By', 'Final Approved By', 'Deduction Reason']
        ];

        // Add claim rows
        claims.forEach(claim => {
          const finalAmount = claim.calculatedEarnings - claim.deductionAmount;
          csvData.push([
            claim._id,
            claim.userId.name,
            claim.userId.email,
            claim.calculatedEarnings.toString(),
            claim.deductionAmount.toString(),
            finalAmount.toString(),
            claim.status,
            formatDate(claim.createdAt),
            claim.reviewedBy?.name || 'N/A',
            claim.finalApprovedBy?.name || 'N/A',
            claim.deductionReason || 'N/A'
          ]);
        });

        downloadCSV(csvData, `claims-report-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        // Export summary data
        // if (!stats) return; // This line was removed as per the edit hint
        
        const csvData = [
          ['Report Type', 'Value'],
          ['Total Claims', stats?.totalClaims.toString() || '0'], // This line was removed as per the edit hint
          ['Pending Claims', stats?.pendingClaims.toString() || '0'], // This line was removed as per the edit hint
          ['Approved Claims', stats?.approvedClaims.toString() || '0'], // This line was removed as per the edit hint
          ['Rejected Claims', stats?.rejectedClaims.toString() || '0'], // This line was removed as per the edit hint
          ['Total Earnings', formatCurrency(stats?.totalEarnings || 0)], // This line was removed as per the edit hint
          ['Total Deductions', formatCurrency(stats?.totalDeductions || 0)], // This line was removed as per the edit hint
          ['Net Earnings', formatCurrency((stats?.totalEarnings || 0) - (stats?.totalDeductions || 0))], // This line was removed as per the edit hint
          ['', ''],
          ['Top Creators', ''],
          ['Name', 'Total Claims', 'Total Earnings']
        ];

        // Add top creators
        // stats.topCreators?.forEach(creator => { // This line was removed as per the edit hint
        //   csvData.push([ // This line was removed as per the edit hint
        //     creator.name, // This line was removed as per the edit hint
        //     creator.totalClaims.toString(), // This line was removed as per the edit hint
        //     formatCurrency(creator.totalEarnings) // This line was removed as per the edit hint
        //   ]); // This line was removed as per the edit hint
        // }); // This line was removed as per the edit hint

        downloadCSV(csvData, `summary-report-${new Date().toISOString().split('T')[0]}.csv`);
      }

      toast.success(`${type === 'claims' ? 'Claims' : 'Summary'} report exported successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const downloadCSV = (data: string[][], filename: string) => {
    const csvContent = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: 'all',
      userId: '',
      minEarnings: '',
      maxEarnings: '',
      searchTerm: ''
    });
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading reports and analytics...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">
                    {/* <FaChartBar className="me-2" /> */}
                    Reports & Analytics Dashboard
                  </h4>
                  <small>Comprehensive reporting and analytics for claim management</small>
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


              {/* Statistics Cards */}
              {stats && (
                <Row className="mb-4">
                  <Col>
                    <Card className="border-0 shadow-sm">
                      <Card.Body>
                        <h5 className="card-title mb-3">Claim Statistics</h5>
                        <Row>
                          <Col xs={6} md={3} className="mb-3">
                            <div className="text-center">
                              <div className="h4 text-warning mb-1">{stats.pendingClaims || 0}</div>
                              <small className="text-muted">Pending</small>
                            </div>
                          </Col>
                          <Col xs={6} md={3} className="mb-3">
                            <div className="text-center">
                              <div className="h4 text-danger mb-1">{stats.rejectedClaims || 0}</div>
                              <small className="text-muted">Deducted</small>
                            </div>
                          </Col>
                          <Col xs={6} md={3} className="mb-3">
                            <div className="text-center">
                              <div className="h4 text-primary mb-1">{stats.approvedClaims || 0}</div>
                              <small className="text-muted">Approved</small>
                            </div>
                          </Col>
                          <Col xs={6} md={3} className="mb-3">
                            <div className="text-center">
                              <div className="h4 text-success mb-1">{formatCurrency(stats.totalEarnings || 0)}</div>
                              <small className="text-muted">Total Earnings</small>
                            </div>
                          </Col>
                        </Row>
                        {user?.role === 'admin' && (
                          <Row className="mt-3">
                            <Col xs={6} md={3} className="mb-3">
                              <div className="text-center">
                                <div className="h4 text-info mb-1">{stats.totalUsers || 0}</div>
                                <small className="text-muted">Total Users</small>
                              </div>
                            </Col>
                            <Col xs={6} md={3} className="mb-3">
                              <div className="text-center">
                                <div className="h4 text-secondary mb-1">{stats.totalPosts || 0}</div>
                                <small className="text-muted">Total Posts</small>
                              </div>
                            </Col>
                            <Col xs={6} md={3} className="mb-3">
                              <div className="text-center">
                                <div className="h4 text-danger mb-1">{formatCurrency(stats.totalDeductions || 0)}</div>
                                <small className="text-muted">Total Deductions</small>
                              </div>
                            </Col>
                            <Col xs={6} md={3} className="mb-3">
                              <div className="text-center">
                                <div className="h4 text-dark mb-1">{stats.totalClaims || 0}</div>
                                <small className="text-muted">Total Claims</small>
                              </div>
                            </Col>
                          </Row>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Export Buttons */}
              <Row className="mb-4">
                <Col xs={12}>
                  <Card className="bg-light">
                    <Card.Body>
                      <h6 className="mb-3">
                        <FaDownload className="me-2" />
                        Export Reports
                      </h6>
                      <div className="d-flex gap-2 flex-wrap">
                        <Button
                          variant="success"
                          onClick={() => exportToCSV('claims')}
                          disabled={exporting}
                        >
                          {/* <FaFileCsv className="me-2" /> */}
                          {exporting ? 'Exporting...' : 'Export Claims Report (CSV)'}
                        </Button>
                        <Button
                          variant="info"
                          onClick={() => exportToCSV('summary')}
                          disabled={exporting}
                        >
                          {/* <FaFileCsv className="me-2" /> */}
                          {exporting ? 'Exporting...' : 'Export Summary Report (CSV)'}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Filters */}
              <Row className="mb-4">
                <Col xs={12}>
                  <Card className="bg-light">
                    <Card.Body>
                      <h6 className="mb-3">
                        <FaFilter className="me-2" />
                        Filters
                      </h6>
                      <Row>
                        <Col md={2}>
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
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Start Date</Form.Label>
                            <Form.Control
                              type="date"
                              value={filters.startDate}
                              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>End Date</Form.Label>
                            <Form.Control
                              type="date"
                              value={filters.endDate}
                              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Status</Form.Label>
                            <Form.Select
                              value={filters.status}
                              onChange={(e) => setFilters({...filters, status: e.target.value})}
                            >
                              <option value="all">All Status</option>
                              <option value="pending">Pending</option>
                              <option value="deducted">Deducted</option>
                              <option value="user_accepted">User Accepted</option>
                              <option value="user_rejected">User Rejected</option>
                              <option value="account_approved">Account Approved</option>
                              <option value="admin_approved">Admin Approved</option>
                              <option value="settled">Settled</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Min Earnings</Form.Label>
                            <Form.Control
                              type="number"
                              placeholder="Min"
                              value={filters.minEarnings}
                              onChange={(e) => setFilters({...filters, minEarnings: e.target.value})}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group>
                            <Form.Label>Max Earnings</Form.Label>
                            <Form.Control
                              type="number"
                              placeholder="Max"
                              value={filters.maxEarnings}
                              onChange={(e) => setFilters({...filters, maxEarnings: e.target.value})}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="mt-2">
                        <Col xs={12}>
                          <Button variant="outline-secondary" onClick={clearFilters}>
                            Clear Filters
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Claims Table */}
              <Row>
                <Col xs={12}>
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">Claims Report ({claims.length} claims)</h6>
                    </Card.Header>
                    <Card.Body>
                      {claims.length === 0 ? (
                        <Alert variant="info">
                          <h6>No Claims Found</h6>
                          <p className="mb-0">
                            {allClaims.length === 0 
                              ? "No claims have been submitted yet."
                              : "No claims match the current filters."
                            }
                          </p>
                        </Alert>
                      ) : (
                        <div className="table-responsive">
                          <Table hover>
                            <thead>
                              <tr>
                                <th>Creator</th>
                                <th>Earnings</th>
                                <th>Deduction</th>
                                <th>Final Amount</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Reviewed By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {claims.map((claim) => {
                                const finalAmount = claim.calculatedEarnings - claim.deductionAmount;
                                return (
                                  <tr key={claim._id}>
                                    <td>
                                      <div>
                                        <strong>{claim.userId.name}</strong>
                                        <br />
                                        <small className="text-muted">{claim.userId.email}</small>
                                      </div>
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
                                        {formatCurrency(finalAmount)}
                                      </strong>
                                    </td>
                                    <td>{getStatusBadge(claim.status)}</td>
                                    <td>{formatDate(claim.createdAt)}</td>
                                    <td>
                                      {claim.reviewedBy?.name || 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </div>
                      )}
                      
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
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Reports; 