import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: "client" | "admin";
    status: "pending" | "active" | "suspended";
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "client" | "admin";
      status: "pending" | "active" | "suspended";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "client" | "admin";
    status: "pending" | "active" | "suspended";
  }
}
