package com.ssafy.ecosim;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
// 데이터가 만들어질때 createdAt, updatedAt 생성을 위한 권한 스위치
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableJpaAuditing
// 알림 발송 등 비동기 처리를 위한 설정
@EnableAsync
public class EcoSimulationApplication {

	public static void main(String[] args) {
		SpringApplication.run(EcoSimulationApplication.class, args);
	}

}
