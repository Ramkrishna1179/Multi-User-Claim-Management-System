import React, { useMemo, memo } from "react";
import {
  Navbar as BootstrapNavbar,
  Nav,
  Container,
  Dropdown,
  Badge,
} from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  FaHome,
  FaFileAlt,
  FaCheckCircle,
  FaChartBar,
  FaUser,
  FaSignOutAlt,
  FaCog,
  FaWifi,
  FaExclamationTriangle,
  FaCogs,
} from "react-icons/fa";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  roles?: string[];
}

const Navbar: React.FC = memo(() => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      user: { variant: "primary", text: "User" },
      account: { variant: "warning", text: "Account Reviewer" },
      admin: { variant: "danger", text: "Admin" },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || {
      variant: "secondary",
      text: role,
    };

    return (
      <Badge
        bg={config.variant}
        style={{
          background: `linear-gradient(135deg, var(--bs-${config.variant}) 0%, var(--bs-${config.variant}-subtle) 100%)`,
          fontSize: "0.7rem",
          padding: "0.25rem 0.5rem",
        }}
      >
        {config.text}
      </Badge>
    );
  };

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        to: "/",
        label: "Dashboard",
        icon: <FaHome />,
        color: "#007bff",
      },
    ];

    if (user?.role === "user") {
      items.push(
        {
          to: "/create-post",
          label: "Create Post",
          icon: <FaFileAlt />,
          color: "#28a745",
        },
        {
          to: "/submit-claim",
          label: "Submit Claim",
          icon: <FaFileAlt />,
          color: "#ffc107",
        }
      );
    }

    if (user?.role === "account") {
      items.push({
        to: "/review-claims",
        label: "Review Claims",
        icon: <FaCheckCircle />,
        color: "#17a2b8",
      });
    }

    if (user?.role === "admin") {
      items.push(
        {
          to: "/final-approval",
          label: "Final Approval",
          icon: <FaCheckCircle />,
          color: "#dc3545",
        },
        {
          to: "/reports",
          label: "Reports",
          icon: <FaChartBar />,
          color: "#6f42c1",
        },
        {
          to: "/admin-settings",
          label: "Admin Settings",
          icon: <FaCogs />,
          color: "#17a2b8",
        }
      );
    }

    return items;
  }, [user?.role]);

  return (
    <BootstrapNavbar
      expand="lg"
      className="navbar-dark"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <Container fluid>
        <BootstrapNavbar.Brand
          as={Link}
          to="/"
          className="d-flex align-items-center"
          style={{
            fontSize: "1.5rem",
            fontWeight: "700",
            background: "linear-gradient(45deg, #fff, #f8f9fa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            margin: "0 0.25rem",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "relative",
            overflow: "hidden",
            backgroundColor: location.pathname === "/" ? "rgba(255, 255, 255, 0.1)" : "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = location.pathname === "/" ? "rgba(255, 255, 255, 0.1)" : "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Claim Manager
          {location.pathname === "/" && (
            <div
              style={{
                position: "absolute",
                bottom: "0",
                left: "0",
                right: "0",
                height: "2px",
                background: "linear-gradient(90deg, #fff, rgba(255, 255, 255, 0.5))",
                borderRadius: "1px",
              }}
            />
          )}
        </BootstrapNavbar.Brand>

        <BootstrapNavbar.Toggle
          aria-controls="basic-navbar-nav"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
          }}
        />

        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {navItems.map((item) => (
              <Nav.Link
                key={item.to}
                as={Link}
                to={item.to}
                className={`d-flex align-items-center gap-2 ${
                  location.pathname === item.to ? "active" : ""
                }`}
                style={{
                  color:
                    location.pathname === item.to
                      ? "#fff"
                      : "rgba(255, 255, 255, 0.8)",
                  fontWeight: location.pathname === item.to ? "600" : "400",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  margin: "0 0.25rem",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span style={{ color: item.color, fontSize: "1.1rem" }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {location.pathname === item.to && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      height: "2px",
                      background:
                        "linear-gradient(90deg, #fff, rgba(255, 255, 255, 0.5))",
                      borderRadius: "1px",
                    }}
                  />
                )}
              </Nav.Link>
            ))}
          </Nav>

          <Nav className="ms-auto d-flex align-items-center gap-3">
            <div
              className="position-relative d-flex align-items-center gap-1"
              style={{ cursor: "pointer" }}
              title={isConnected ? "WebSocket Server: Connected ✅" : "WebSocket Server: Disconnected ⚠️"}
            >
              {isConnected ? (
                <>
                  <FaWifi 
                    className="text-success" 
                    style={{ fontSize: "1.1rem" }}
                    title="WebSocket Server: Connected ✅"
                  />
                  <span 
                    className="text-success small"
                    style={{ fontSize: "0.8rem", fontWeight: "500" }}
                  >
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <FaExclamationTriangle 
                    className="text-warning" 
                    style={{ fontSize: "1.1rem" }}
                    title="WebSocket Server: Disconnected ⚠️"
                  />
                  <span 
                    className="text-warning small"
                    style={{ fontSize: "0.8rem", fontWeight: "500" }}
                  >
                    Disconnected
                  </span>
                </>
              )}
            </div>

            <Dropdown align="end">
              <Dropdown.Toggle
                variant="link"
                className="d-flex align-items-center gap-2 text-decoration-none"
                style={{
                  color: "rgba(255, 255, 255, 0.9)",
                  border: "none",
                  background: "transparent",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "35px",
                    height: "35px",
                    background: user?.profileImageUrl
                      ? "none"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                  }}
                >
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt="Profile"
                      className="rounded-circle"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <FaUser />
                  )}
                </div>
                <span
                  className="d-none d-lg-block"
                  style={{ fontWeight: "500" }}
                >
                  {user?.name}
                </span>
              </Dropdown.Toggle>

              <Dropdown.Menu
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                  padding: "0.5rem",
                }}
              >
                <Dropdown.Header
                  style={{
                    fontWeight: "600",
                    color: "#333",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
                    paddingBottom: "0.5rem",
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: "30px",
                        height: "30px",
                        background: user?.profileImageUrl
                          ? "none"
                          : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "#fff",
                        fontSize: "0.8rem",
                      }}
                    >
                      {user?.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt="Profile"
                          className="rounded-circle"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <FaUser />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.9rem" }}>{user?.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#666" }}>
                        {user?.email}
                      </div>
                      {getRoleBadge(user?.role || "user")}
                    </div>
                  </div>
                </Dropdown.Header>



                <Dropdown.Item
                  onClick={handleLogout}
                  style={{
                    borderRadius: "8px",
                    margin: "0.25rem 0",
                    color: "#dc3545",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(220, 53, 69, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <FaSignOutAlt className="me-2" />
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
});

Navbar.displayName = "Navbar";

export default Navbar;
