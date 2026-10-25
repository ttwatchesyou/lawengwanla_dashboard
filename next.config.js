/* eslint-disable */
const withAntdLess = require("next-plugin-antd-less");

/** @type {import('next').NextConfig} */
const nextConfig = withAntdLess({
  // ถ้าต้องการปรับ theme ของ antd
  modifyVars: { "@primary-color": "#1e3271" }, // หรือ import from less file
  // ปรับ SASS/LESS options ผ่าน sassOptions หรือ modifyVars
  compiler: {
    styledComponents: true, // เปิด support styled-components
  },
  webpack(config) {
    return config;
  },
  async rewrites() {
    // Keep browser requests same-origin so the dashboard works through a
    // single SSH-forwarded port (localhost:3025).  The Flask backend stays
    // on the robot and is reached only by the Next.js server.
    return [{
      source: "/api/telemetry/:path*",
      destination: "http://127.0.0.1:8002/api/telemetry/:path*",
    }, {
      source: "/api/:path*",
      destination: "http://127.0.0.1:8001/api/:path*",
    }];
  },
});

module.exports = nextConfig;
