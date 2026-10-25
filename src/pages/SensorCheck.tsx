import TofPanel from "../../components/TofPanel";
import ProximityPanel from "../../components/ProximityPanel";
import GripperAxesPanel from "../../components/GripperAxesPanel";
import Head from "next/head";
import styled from "styled-components";
import Layout from "../../components/Layout/Layout";
import Io595RobotControl from "../../components/Io595RobotControl";

export default function SensorCheck() {
  return <Page aria-label="สถานะเซนเซอร์และชุดจับ">
    <Head><title>เซนเซอร์ · Lawengwanla</title></Head>
    <Content><Heading>เซนเซอร์และชุดจับ <span>/ Sensor Check</span></Heading><TofPanel /><ProximityPanel /><GripperAxesPanel /><Io595RobotControl /></Content>
  </Page>;
}
SensorCheck.getLayout = (page: React.ReactElement) => <Layout hideFooter>{page}</Layout>;
const Page = styled.main`min-height:100dvh;padding:88px 22px 20px;background:#f6f4e8;color:#203651;@media(max-width:700px){padding:82px 12px 20px}`;
const Content = styled.div`max-width:1440px;margin:auto`;
const Heading = styled.h1`font-size:26px;margin:0 0 16px;span{font-size:14px;color:#83909b;font-weight:400}`;
