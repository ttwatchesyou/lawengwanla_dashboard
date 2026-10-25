# Wheel Tuner และเฟิร์มแวร์ G/V/X/Z/S/P พร้อมส่วนขยายล้อ v1

โครงการ STM32: `/home/ubuntu/Lawengwanla_cpp/wheel_tuner`
เพิ่มส่วนขยายตามที่ผู้ใช้อนุญาตวันที่ 23 ตุลาคม 2026 โดยคงคำสั่งตำแหน่งเดิมและ I2C IMU 50 kHz

| คำสั่ง | หน้าที่ |
|---|---|
| `G<x>:<y>:<yaw>` | เป้าตำแหน่งสัมบูรณ์ m/m/rad |
| `V<vx>:<vy>` | Manual XY m/s จับ yaw ตอนเข้า manual |
| `X` | หยุดและยกเลิกโหมดทดสอบล้อ |
| `Z` | หยุดและรีเซ็ต odometry X/Y คง yaw |
| `S<speed>` | เพดานความเร็ว XY ค่าบวก |
| `P5:<max_rpm>:<kp>:<kd>` | Yaw PD ค่าทั้งสาม >0 |
| `P6/P7:<kp>:<ki>:<kd>` | PID ตำแหน่ง X/Y |
| `P1/P2/P3/P4:<kp>:<ki>:<kd>` | PID ความเร็วล้อ FL/FR/RL/RR ช่วง 0–9999 ปรับเมื่อหยุดเท่านั้น |
| `Q` | อ่าน PID ปัจจุบันทั้งสี่ล้อ |
| `W<mask>:<rpm>` | ทดสอบ FL=1 FR=2 RL=4 RR=8 ALL=15 ช่วง -300 ถึง 300 RPM |

## ข้อมูลจากบอร์ด

`POS:<x>:<y>:<yaw>:<tick_x>:<tick_y>` ยังคงรูปแบบและความถี่เดิม 50 Hz

`WHEEL:1:<ms>:<enabled>:<mask>:<imu_fresh>:<target FL/FR/RL/RR>:<rpm FL/FR/RL/RR>:<pwm FL/FR/RL/RR>:<tick FL/FR/RL/RR>` ส่ง 10 Hz แต่ละค่าแยกด้วย colon รวม 22 fields

RPM เป็น encoder หลัง Kalman ในบอร์ด ไม่ได้ประมาณจาก POS; PWM เป็น signed duty -255..255 ที่ใช้สั่งขา DIR/PWM หลังจำกัดค่าและ deadband
`enabled=0` หมายถึงคำสั่งมอเตอร์หยุด ส่วนการหยุดจริงให้ดู RPM ประกอบ

`WPID:<id 1..4>:<kp>:<ki>:<kd>` เป็นค่าที่บอร์ดใช้อยู่ ส่งทันทีหลังรับ P1–P4, เมื่ออ่าน Q และซ้ำทุก 1 วินาที
`WERR:BUSY` คือบอร์ดยังควบคุมมอเตอร์อยู่จึงไม่รับ PID; `WERR:INVALID` คือคำสั่งส่วนขยายไม่ถูกต้อง
PID เก็บใน RAM ไม่มีการเขียน flash/EEPROM จึงกลับค่าเริ่มต้นเมื่อรีเซ็ตบอร์ด

## หน้าเว็บ /WheelTuner และ /RobotTuner

- แสดง RPM เป้าและจริงแยกสี่ล้อ กราฟเส้นทึบ/เส้นประ พร้อม PWM และ tick
- ช่อง Kp/Ki/Kd รายล้อเริ่มจาก source แล้วรับค่าจากบอร์ดครั้งแรกเมื่อผู้ใช้ยังไม่แก้ฟอร์ม ปุ่มใช้ค่าบอร์ดดึง readback มาใส่ได้
- การเปิดหน้าและแก้ช่องไม่ส่ง PID หรือเริ่มมอเตอร์ ปุ่มส่ง PID ทำงานเมื่อ WHEEL สดและมอเตอร์หยุด
- Backend รอ WPID ใหม่ของล้อเดียวกันและค่าตรงกับคำสั่ง จึงรายงาน acknowledged=true; timeout ไม่อ้างว่าบอร์ดยืนยันแล้ว
- ปุ่มทดสอบส่ง W ทุก 200 ms หลังผู้ใช้เปิดช่องทดสอบและกดเริ่ม ใช้ RPM ตอนกดเริ่ม หากเปลี่ยน RPM ให้หยุดแล้วเริ่มใหม่
- หยุดทดสอบด้วย X, ออกจากหน้า/สลับหน้าต่าง/ข้อมูลค้างจะพยายามส่ง X และยกเลิกการส่ง W ต่อ
- MCU ยกเลิกโหมด W เมื่อขาดคำสั่งเกิน 700 ms; ล้อที่ไม่ได้เลือกมี PWM=0; การอ่านกราฟไม่ต่ออายุโหมดนี้
- เงื่อนไขหยุดเมื่อ IMU ไม่พร้อม/reset/ข้อมูลเก่าเกิน 250 ms ยังอยู่ การทดสอบล้อจึงต้องมี IMU สดเช่นกัน
- POS อย่างเดียวจากเฟิร์มแวร์เก่ายังใช้หน้าตำแหน่งได้ แต่ปุ่มจูนและทดสอบรายล้อปิดไว้จนได้รับ WHEEL v1 สดจริง
- คำสั่ง G/V/X/Z/S/P5–P7 ยังไม่มี ACK และ V เดิมยังไม่มี host-command timeout
- ยังไม่มี Auto-tune อัตโนมัติ

ไฟล์หน้าเว็บ: `components/OriginalFirmwareTuner.tsx`, `components/OriginalWheelTuning.tsx`, `utils/originalTuner.ts`
ตัวรับ UART: `lawengwanla_backend/original_tuner.py`, `backend_node.py`
ตัวตรวจส่วนขยาย firmware: `include/wheel_tuning_protocol.h`

## Build / upload

```bash
cd /home/ubuntu/Lawengwanla_cpp/wheel_tuner
./build_upload.sh build
./build_upload.sh flash
```

สคริปต์ล็อก USB path และ UID บอร์ดล้อ สำรอง flash 64 KiB ก่อนเขียนและ verify หลังเขียน
เมื่อ binary มี WHEEL v1 จะตรวจ POS, WHEEL หยุดต่อเนื่อง และ WPID ครบสี่ล้อหลังบูต
