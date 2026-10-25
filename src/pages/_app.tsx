/* eslint-disable */
import type { AppProps } from "next/app";
import type { NextPage } from "next";
import { ReactElement, ReactNode } from "react";
import { ConfigProvider } from "antd";
import Layout from "../../components/Layout/Layout";
import theme from "../../theme/themeConfig";
import "../styles/globals.css";
import "antd/dist/reset.css";
import GlobalServiceMonitor from "../../components/GlobalServiceMonitor";

// 🌟 Import Component ปุ่ม Shutdown เข้ามา
import FloatingShutdown from "../../components/FloatingShutdown"; 
import FloatingKioskExit from "../../components/FloatingKioskExit";

export type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => <Layout>{page}</Layout>);

  return (
    <ConfigProvider theme={theme}>
      <GlobalServiceMonitor /> 
      {getLayout(<Component {...pageProps} />)}
      <FloatingKioskExit />
    </ConfigProvider>
  );
}

export default MyApp;
