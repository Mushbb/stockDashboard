package stockDashboard.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import lombok.RequiredArgsConstructor;
import stockDashboard.service.UserService;

@RestController
@RequestMapping("/api") // 기본 경로를 /api로 변경
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    private record UserRegistrationRequest(String username, String password) {}

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

    @GetMapping("/user") // /api/user 경로
    public ResponseEntity<UserDetails> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userDetails);
    }
}