package com.ssafy.ecosim.domain.feedback.dto.request;

import com.ssafy.ecosim.domain.feedback.entity.FeedbackCategory;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
@Schema(description = "피드백 제출 요청")
public class FeedbackRequest {

    @NotNull(message = "카테고리를 선택해주세요.")
    @Schema(description = "피드백 유형 (BUG, IMPROVEMENT, INQUIRY, OTHER)", example = "BUG")
    private FeedbackCategory category;

    @NotBlank(message = "내용을 입력해주세요.")
    @Size(max = 1000, message = "내용은 1000자 이하로 입력해주세요.")
    @Schema(description = "피드백 내용", example = "작업장에서 생산 완료 후 창고에 아이템이 들어오지 않습니다.")
    private String content;
}
