package stockDashboard.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import stockDashboard.service.UserService;

/**
 * 사용자 관련 API 요청을 처리하는 컨트롤러입니다.
 * 회원가입 및 사용자 정보 조회를 담당합니다.
 */
@RestController
@RequestMapping("/api") // 기본 경로를 /api로 변경
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 회원가입 요청 시 사용될 데이터를 담는 레코드 클래스입니다.
     * @param username 사용자 이름
     * @param password 비밀번호
     */
    private record UserRegistrationRequest(String username, String password) {}

    /**
     * 새로운 사용자를 등록하는 API 엔드포인트입니다.
     *
     * @param request 사용자 이름과 비밀번호를 포함하는 요청 바디
     * @return 성공 시 200 OK, 잘못된 요청 시 400 Bad Request, 서버 오류 시 500 Internal Server Error
     */
    @PostMapping("/users/register") // 전체 경로 명시
    public ResponseEntity<Void> registerUser(@RequestBody UserRegistrationRequest request) {
        try {
            userService.registerNewUser(request.username(), request.password());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 현재 인증된 사용자의 정보를 반환하는 API 엔드포인트입니다.
     *
     * @param userDetails Spring Security가 주입해주는 현재 사용자의 상세 정보
     * @return 현재 사용자의 UserDetails 객체를 포함하는 ResponseEntity
     */
    @GetMapping("/user") // /api/user 경로
    public ResponseEntity<UserDetails> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userDetails);
    }
}