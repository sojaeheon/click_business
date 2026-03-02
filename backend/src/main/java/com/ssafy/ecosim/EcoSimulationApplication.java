package com.ssafy.ecosim;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class EcoSimulationApplication {

	public static void main(String[] args) {
		SpringApplication.run(EcoSimulationApplication.class, args);
	}

}
